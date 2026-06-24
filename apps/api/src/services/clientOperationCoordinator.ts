import { AsyncLocalStorage } from "node:async_hooks";

type UploadContext = {
  clientId: string;
  generation: number;
};

type ClientOperationState = {
  generation: number;
  uploadActive: boolean;
  criticalSection: Promise<void>;
};

export class UploadAlreadyInProgressError extends Error {
  constructor() {
    super("UPLOAD_ALREADY_IN_PROGRESS");
    this.name = "UploadAlreadyInProgressError";
  }
}

export class UploadInvalidatedByResetError extends Error {
  constructor() {
    super("UPLOAD_INVALIDATED_BY_RESET");
    this.name = "UploadInvalidatedByResetError";
  }
}

export class ClientOperationCoordinator {
  private readonly uploadContext = new AsyncLocalStorage<UploadContext>();
  private readonly states = new Map<string, ClientOperationState>();

  private stateFor(clientId: string) {
    const existing = this.states.get(clientId);
    if (existing) {
      return existing;
    }

    const state: ClientOperationState = {
      generation: 0,
      uploadActive: false,
      criticalSection: Promise.resolve()
    };
    this.states.set(clientId, state);
    return state;
  }

  private async runCritical<T>(
    clientId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const state = this.stateFor(clientId);
    const previous = state.criticalSection;
    let release: () => void = () => undefined;
    state.criticalSection = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async runUpload<T>(
    clientId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const state = this.stateFor(clientId);
    if (state.uploadActive) {
      throw new UploadAlreadyInProgressError();
    }

    state.uploadActive = true;
    const context = {
      clientId,
      generation: state.generation
    };

    try {
      return await this.uploadContext.run(context, operation);
    } finally {
      state.uploadActive = false;
    }
  }

  async commitUpload<T>(
    clientId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const context = this.uploadContext.getStore();
    if (!context || context.clientId !== clientId) {
      throw new UploadInvalidatedByResetError();
    }

    return this.runCritical(clientId, async () => {
      if (this.stateFor(clientId).generation !== context.generation) {
        throw new UploadInvalidatedByResetError();
      }

      return operation();
    });
  }

  async runReset<T>(
    clientId: string,
    operation: () => Promise<T>
  ): Promise<T> {
    return this.runCritical(clientId, async () => {
      this.stateFor(clientId).generation += 1;
      return operation();
    });
  }
}
