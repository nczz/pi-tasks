export interface IdGenerator {
	next(prefix: string): string;
}

export class SequentialIdGenerator implements IdGenerator {
	private readonly counters = new Map<string, number>();

	next(prefix: string): string {
		const nextValue = (this.counters.get(prefix) ?? 0) + 1;
		this.counters.set(prefix, nextValue);
		return `${prefix}${nextValue}`;
	}
}

export function createEventId(
	taskId: string,
	createdAt: string,
	type: string,
): string {
	const safeType = type.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
	return `${taskId}-${safeType}-${createdAt}`;
}
