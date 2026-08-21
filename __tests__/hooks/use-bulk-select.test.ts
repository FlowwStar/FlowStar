import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBulkSelect } from "@/hooks/useBulkSelect";

interface TestItem {
  id: string;
  name: string;
}

const testItems: TestItem[] = [
  { id: "1", name: "Item 1" },
  { id: "2", name: "Item 2" },
  { id: "3", name: "Item 3" },
];

describe("useBulkSelect", () => {
  describe("initial state", () => {
    it("starts with empty selection when no items", () => {
      const { result } = renderHook(() => useBulkSelect<TestItem>([]));
      expect(result.current.selected.size).toBe(0);
      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });

    it("starts with empty selection when items exist", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      expect(result.current.selected.size).toBe(0);
      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });
  });

  describe("toggle", () => {
    it("adds an item to selection when toggled on", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => result.current.toggle("1"));
      expect(result.current.selected.has("1")).toBe(true);
      expect(result.current.selectedItems).toEqual([
        { id: "1", name: "Item 1" },
      ]);
      expect(result.current.someSelected).toBe(true);
      expect(result.current.allSelected).toBe(false);
    });

    it("removes an item from selection when toggled off", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => {
        result.current.toggle("1");
        result.current.toggle("1");
      });
      expect(result.current.selected.has("1")).toBe(false);
      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.someSelected).toBe(false);
      expect(result.current.allSelected).toBe(false);
    });

    it("toggles multiple items independently", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => {
        result.current.toggle("1");
        result.current.toggle("2");
      });
      expect(result.current.selected.size).toBe(2);
      expect(result.current.selectedItems).toEqual([
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
      ]);
      expect(result.current.someSelected).toBe(true);
      expect(result.current.allSelected).toBe(false);
    });
  });

  describe("toggleAll", () => {
    it("selects all items when none selected", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => result.current.toggleAll());
      expect(result.current.selected.size).toBe(3);
      expect(result.current.selectedItems).toEqual(testItems);
      expect(result.current.allSelected).toBe(true);
      expect(result.current.someSelected).toBe(true);
    });

    it("deselects all items when all selected", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => {
        result.current.toggleAll();
        result.current.toggleAll();
      });
      expect(result.current.selected.size).toBe(0);
      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });

    it("selects all items when some selected", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => {
        result.current.toggle("1");
        result.current.toggleAll();
      });
      expect(result.current.selected.size).toBe(3);
      expect(result.current.selectedItems).toEqual(testItems);
      expect(result.current.allSelected).toBe(true);
      expect(result.current.someSelected).toBe(true);
    });

    it("does nothing when items array is empty", () => {
      const { result } = renderHook(() => useBulkSelect<TestItem>([]));
      act(() => result.current.toggleAll());
      expect(result.current.selected.size).toBe(0);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });
  });

  describe("clear", () => {
    it("clears all selections", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => {
        result.current.toggle("1");
        result.current.toggle("2");
      });
      expect(result.current.selected.size).toBe(2);
      act(() => result.current.clear());
      expect(result.current.selected.size).toBe(0);
      expect(result.current.selectedItems).toEqual([]);
      expect(result.current.allSelected).toBe(false);
      expect(result.current.someSelected).toBe(false);
    });

    it("does nothing when already empty", () => {
      const { result } = renderHook(() => useBulkSelect(testItems));
      act(() => result.current.clear());
      expect(result.current.selected.size).toBe(0);
      expect(result.current.selectedItems).toEqual([]);
    });
  });
});
