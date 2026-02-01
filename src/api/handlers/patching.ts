import type { IProjectFlowPlugin } from "../../interfaces";
import type { PatchMarkerRequest, PatchSectionRequest, PatchResult } from "../types";
import { patchMarkerInFile, patchSectionInFile } from "../../core/markdown-patcher";
import { validatePatchMarkerRequest, validatePatchSectionRequest } from "../validators";

export function createPatchingHandlers(plugin: IProjectFlowPlugin) {
  return {
    patchMarker: async (req: PatchMarkerRequest): Promise<PatchResult> => {
      validatePatchMarkerRequest(req);
      return patchMarkerInFile(plugin.app, req);
    },
    patchSection: async (req: PatchSectionRequest): Promise<PatchResult> => {
      validatePatchSectionRequest(req);
      return patchSectionInFile(plugin.app, req);
    },
  };
}
