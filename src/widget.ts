import type { TaskState } from "./model.ts";
import type { ExtensionContext } from "./pi-types.ts";
import { formatStatusText, formatWidgetLines } from "./render.ts";

export function updateTaskUi(ctx: ExtensionContext, state: TaskState): void {
	ctx.ui.setStatus("pi-tasks", formatStatusText(state));
	ctx.ui.setWidget("pi-tasks", formatWidgetLines(state), {
		placement: "aboveEditor",
	});
}
