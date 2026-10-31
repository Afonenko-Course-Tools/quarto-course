/** Инертная точка existing capture scope: до gate не импортирует project/metrics runtime. */
import { prepareAssignment } from "./runtime/assignment-admission.ts";
import type { AssignmentPreparation } from "./runtime/assignment-admission.ts";
import type {
  NativeCaptureReservation,
  NativeCaptureScopeOptions,
} from "./runtime/contracts.ts";
import type { withNativeCaptureScope as OrdinaryCapture } from "./runtime/operation.ts";
export type NativeAssignmentPreparation = AssignmentPreparation;
export async function withNativeCaptureScope<T>(
  reservation: NativeCaptureReservation,
  options: NativeCaptureScopeOptions | NativeAssignmentPreparation,
  use: Parameters<typeof OrdinaryCapture<T>>[2],
): Promise<T> {
  if (options && Object.hasOwn(options, "assignment")) {
    const fixedReservation = Object.freeze({ ...reservation });
    const prepared = await prepareAssignment(
      fixedReservation,
      options as AssignmentPreparation,
    );
    const runtime = await import("./runtime/operation.ts");
    return await runtime.withPreparedNativeCaptureScope(
      prepared,
      fixedReservation,
      use,
    );
  }
  const runtime = await import("./runtime/operation.ts");
  return await runtime.withNativeCaptureScope(
    reservation,
    options as NativeCaptureScopeOptions,
    use,
  );
}
