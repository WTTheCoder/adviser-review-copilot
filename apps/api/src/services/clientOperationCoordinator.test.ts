import { describe, expect, it } from "vitest";
import {
  ClientOperationCoordinator,
  UploadInvalidatedByResetError
} from "./clientOperationCoordinator.js";

describe("ClientOperationCoordinator", () => {
  it("releases idle client state after completed operations", async () => {
    const coordinator = new ClientOperationCoordinator();

    await coordinator.runUpload("client-one", async () => "stored");
    await coordinator.runReset("client-two", async () => "reset");

    expect(coordinator.trackedClientCount).toBe(0);
  });

  it("releases idle client state after failed operations", async () => {
    const coordinator = new ClientOperationCoordinator();

    await expect(
      coordinator.runUpload("client-one", async () => {
        throw new Error("test failure");
      })
    ).rejects.toThrow("test failure");

    expect(coordinator.trackedClientCount).toBe(0);
  });

  it("keeps reset generation state until an older upload is rejected", async () => {
    const coordinator = new ClientOperationCoordinator();
    let continueUpload: () => void = () => undefined;
    const uploadPaused = new Promise<void>((resolve) => {
      continueUpload = resolve;
    });

    const upload = coordinator.runUpload("client-one", async () => {
      await uploadPaused;
      return coordinator.commitUpload("client-one", async () => "stored");
    });

    await coordinator.runReset("client-one", async () => "reset");
    expect(coordinator.trackedClientCount).toBe(1);

    continueUpload();
    await expect(upload).rejects.toBeInstanceOf(
      UploadInvalidatedByResetError
    );
    expect(coordinator.trackedClientCount).toBe(0);
  });
});
