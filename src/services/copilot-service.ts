/**
 * Copilot AI service abstraction.
 *
 * Defines the contract for answering user questions with evidence-grounded
 * responses. Two implementations are provided:
 *
 *   - MockCopilotService: Uses the existing mock evidence index for DEMO_MODE.
 *   - NemotronCopilotService: Planned NVIDIA Nemotron backend.
 *
 * The UI always imports { copilotService } from here and never knows which
 * implementation is active. Swapping between providers is driven by
 * DEMO_MODE in src/lib/speclens/config.ts.
 *
 * The `CopilotService` and `CopilotAnswer` types are exported for consumers.
 */
import { DEMO_MODE } from "@/lib/speclens/config";
import type { CopilotAnswer, CopilotService } from "@/types/speclens";
import { MockCopilotService } from "./mock-service";
import { NemotronCopilotService } from "./nemotron-service";

export { MockCopilotService, NemotronCopilotService };

/** The active copilot service implementation. */
export const copilotService: CopilotService = DEMO_MODE
  ? new MockCopilotService()
  : new NemotronCopilotService();
