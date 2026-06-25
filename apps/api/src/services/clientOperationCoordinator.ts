import { AsyncLocalStorage } from "node:async_hooks";

type ClientMutationContext = {
  clientId: string;
  generation: number;
};

type ClientOperationState = {
  generation: number;
  pendingOperations: number;
  queue: Promise<void>;
};

type ClientMutationOptions = {
  rejectIfBusy?: boolean;
};

export class ClientMutationBusyError extends Error {
  constructor() {
    super("CLIENT_MUTATION_BUSY");
    this.name = "ClientMutationBusyError";
  }
}

export class ClientMutationInvalidatedError extends Error {
  constructor() {
    super("CLIENT_MUTATION_INVALIDATED");
    this.name = "ClientMutationInvalidatedError";
  }
}

export class ClientOperationCoordinator {
  private readonly mutationContext =
    new AsyncLocalStorage<ClientMutationContext>();
  private readonly states = new Map<string, ClientOperationState>();

  private stateFor(clientId: string) {
    const existing = this.states.get(clientId);
    if (existing) {
      return existing;
    }

    const state: ClientOperationState = {
      generation: 0,
      pendingOperations: 0,
      queue: Promise.resolve()
    };
    this.states.set(clientId, state);
    return state;
  }

  private releaseIfIdle(clientId: string, state: ClientOperationState) {
    if (
      state.pendingOperations === 0 &&
      this.states.get(clientId) === state
    ) {
      this.states.delete(clientId);
    }
  }

  private async runExclusive<T>(
    clientId: string,
    operation: (generation: number) => Promise<T>,
    options: ClientMutationOptions = {}
  ): Promise<T> {
    const state = this.stateFor(clientId);
    if (options.rejectIfBusy && state.pendingOperations > 0) {
      throw new ClientMutationBusyError();
    }

    state.pendingOperations += 1;
    const previous = state.queue;
    let release: () => void = () => undefined;
    state.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation(state.generation);
    } finally {
      release();
      state.pendingOperations -= 1;
      this.releaseIfIdle(clientId, state);
    }
  }

  async runClientMutation<T>(
    clientId: string,
    operation: () => Promise<T>,
    options: ClientMutationOptions = {}
  ): Promise<T> {
    return this.runExclusive(
      clientId,
      (generation) =>
        this.mutationContext.run({ clientId, generation }, operation),
      options
    );
  }

  async commitIfCurrentGeneration<T>(
    clientId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const context = this.mutationContext.getStore();
    const state = this.states.get(clientId);
    if (
      !context ||
      context.clientId !== clientId ||
      !state ||
      state.generation !== context.generation
    ) {
      throw new ClientMutationInvalidatedError();
    }

    return operation();
  }

  async runReset<T>(
    clientId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.runExclusive(clientId, async () => {
      const state = this.stateFor(clientId);
      state.generation += 1;
      return this.mutationContext.run(
        { clientId, generation: state.generation },
        operation
      );
    });
  }

  get trackedClientCount() {
    return this.states.size;
  }
}
