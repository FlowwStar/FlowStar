import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBulkActions } from "@/hooks/useBulkActions";

describe("useBulkActions", () => {
  describe("initial state", () => {
    it("starts with idle status and empty results", () => {
      const { result } = renderHook(() => useBulkActions());
      expect(result.current.status).toBe("idle");
      expect(result.current.progress).toEqual({ done: 0, total: 0 });
      expect(result.current.results).toEqual([]);
      expect(result.current.succeeded).toBe(0);
      expect(result.current.failed).toBe(0);
    });
  });

  describe("runBulk", () => {
    it("processes all items successfully", async () => {
      const mockAction = vi.fn().mockResolvedValue(undefined);
      const ids = ["1", "2", "3"];
      const { result } = renderHook(() => useBulkActions());

      await act(async () => {
        await result.current.runBulk(ids, mockAction);
      });

      expect(mockAction).toHaveBeenCalledTimes(3);
      expect(mockAction).toHaveBeenCalledWith("1");
      expect(mockAction).toHaveBeenCalledWith("2");
      expect(mockAction).toHaveBeenCalledWith("3");
      expect(result.current.status).toBe("done");
      expect(result.current.progress).toEqual({ done: 3, total: 3 });
      expect(result.current.results).toEqual([
        { id: "1", success: true },
        { id: "2", success: true },
        { id: "3", success: true },
      ]);
      expect(result.current.succeeded).toBe(3);
      expect(result.current.failed).toBe(0);
    });

    it("handles failures gracefully", async () => {
      const mockAction = vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);
      const ids = ["1", "2", "3"];
      const { result } = renderHook(() => useBulkActions());

      await act(async () => {
        await result.current.runBulk(ids, mockAction);
      });

      expect(result.current.status).toBe("done");
      expect(result.current.progress).toEqual({ done: 3, total: 3 });
      expect(result.current.results).toEqual([
        { id: "1", success: true },
        { id: "2", success: false, error: "Network error" },
        { id: "3", success: true },
      ]);
      expect(result.current.succeeded).toBe(2);
      expect(result.current.failed).toBe(1);
    });

    it("updates status and progress during processing", async () => {
      let resolve1: () => void;
      let resolve2: () => void;
      const promise1 = new Promise<void>((resolve) => {
        resolve1 = resolve;
      });
      const promise2 = new Promise<void>((resolve) => {
        resolve2 = resolve;
      });
      const mockAction = vi
        .fn()
        .mockImplementationOnce(() => promise1)
        .mockImplementationOnce(() => promise2);

      const ids = ["1", "2"];
      const { result } = renderHook(() => useBulkActions());

      let runPromise: Promise<void>;
      act(() => {
        runPromise = result.current.runBulk(ids, mockAction);
      });

      expect(result.current.status).toBe("running");
      expect(result.current.progress).toEqual({ done: 0, total: 2 });
      expect(result.current.results).toEqual([]);

      await act(async () => {
        resolve1();
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(result.current.progress).toEqual({ done: 1, total: 2 });
      expect(result.current.results).toEqual([{ id: "1", success: true }]);

      await act(async () => {
        resolve2();
        await runPromise;
      });

      expect(result.current.status).toBe("done");
      expect(result.current.progress).toEqual({ done: 2, total: 2 });
      expect(result.current.results).toEqual([
        { id: "1", success: true },
        { id: "2", success: true },
      ]);
    });

    it("handles empty ids array", async () => {
      const mockAction = vi.fn();
      const { result } = renderHook(() => useBulkActions());

      await act(async () => {
        await result.current.runBulk([], mockAction);
      });

      expect(mockAction).not.toHaveBeenCalled();
      expect(result.current.status).toBe("done");
      expect(result.current.progress).toEqual({ done: 0, total: 0 });
      expect(result.current.results).toEqual([]);
      expect(result.current.succeeded).toBe(0);
      expect(result.current.failed).toBe(0);
    });

    it("captures error message from rejected promise", async () => {
      const mockAction = vi
        .fn()
        .mockRejectedValue(new Error("Custom error message"));
      const { result } = renderHook(() => useBulkActions());

      await act(async () => {
        await result.current.runBulk(["1"], mockAction);
      });

      expect(result.current.results[0]).toEqual({
        id: "1",
        success: false,
        error: "Custom error message",
      });
    });
  });
});
