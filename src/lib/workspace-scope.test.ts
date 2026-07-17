import { describe, expect, it } from "vitest";
import { assertWorkspaceId, scopedWhere } from "./workspace-scope";

describe("workspace scope", () => {
  it("adds workspace_id to service queries", () => {
    expect(scopedWhere("workspace-1", { deletedAt: null })).toEqual({
      workspaceId: "workspace-1",
      deletedAt: null,
    });
  });

  it("rejects empty workspace ids", () => {
    expect(() => assertWorkspaceId("")).toThrow("缺少当前 Workspace");
  });
});

