import { describe, expect, it } from "vitest";
import {
  ClientMutationBusyError,
  ClientMutationInvalidatedError,
  ClientOperationCoordinator
} from "./clientOperationCoordinator.js";

const deferred = () => {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe("ClientOperationCoordinator", () => {
  it("serializes mutations and lets reset run after active work", async () => {
    const coordinator = new ClientOperationCoordinator();
    const releaseMutation = deferred();
    const mutationStarted = deferred();
    const order: string[] = [];

    const mutation = coordinator.runClientMutation("client-one", async () => {
      order.push("mutation-start");
      mutationStarted.resolve();
      await releaseMutation.promise;
      order.push("mutation-end");
    });
    await mutationStarted.promise;

    const reset = coordinator.runReset("client-one", async () => {
      order.push("reset");
    });
    await Promise.resolve();
    expect(order).toEqual(["mutation-start"]);

    releaseMutation.resolve();
    await Promise.all([mutation, reset]);
    expect(order).toEqual(["mutation-start", "mutation-end", "reset"]);
    expect(coordinator.trackedClientCount).toBe(0);
  });

  it("rejects a busy mutation when requested and releases after failure", async () => {
    const coordinator = new ClientOperationCoordinator();
    const releaseMutation = deferred();
    const mutationStarted = deferred();
    const active = coordinator.runClientMutation("client-one", async () => {
      mutationStarted.resolve();
      await releaseMutation.promise;
    });
    await mutationStarted.promise;

    await expect(
      coordinator.runClientMutation(
        "client-one",
        async () => undefined,
        { rejectIfBusy: true }
      )
    ).rejects.toBeInstanceOf(ClientMutationBusyError);

    releaseMutation.resolve();
    await active;
    await expect(
      coordinator.runClientMutation("client-one", async () => {
        throw new Error("test failure");
      })
    ).rejects.toThrow("test failure");
    expect(coordinator.trackedClientCount).toBe(0);
  });

  it("does not block mutations for different clients", async () => {
    const coordinator = new ClientOperationCoordinator();
    const releaseFirst = deferred();
    const firstStarted = deferred();
    let secondCompleted = false;

    const first = coordinator.runClientMutation("client-one", async () => {
      firstStarted.resolve();
      await releaseFirst.promise;
    });
    await firstStarted.promise;
    await coordinator.runClientMutation("client-two", async () => {
      secondCompleted = true;
    });

    expect(secondCompleted).toBe(true);
    releaseFirst.resolve();
    await first;
  });

  it("allows commits only inside the current coordinated generation", async () => {
    const coordinator = new ClientOperationCoordinator();

    await expect(
      coordinator.commitIfCurrentGeneration("client-one", async () => "stored")
    ).rejects.toBeInstanceOf(ClientMutationInvalidatedError);
    await expect(
      coordinator.runClientMutation("client-one", () =>
        coordinator.commitIfCurrentGeneration(
          "client-one",
          async () => "stored"
        )
      )
    ).resolves.toBe("stored");
  });
});
