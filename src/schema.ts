export type Schema = Record<string, unknown> & { optional?: true };

export const Type = {
	Object(properties: Record<string, Schema>): Schema {
		const required = Object.entries(properties)
			.filter(([, schema]) => !schema.optional)
			.map(([name]) => name);
		const normalized = Object.fromEntries(
			Object.entries(properties).map(([name, schema]) => {
				const { optional: _optional, ...rest } = schema;
				return [name, rest];
			}),
		);
		return {
			type: "object",
			properties: normalized,
			required,
			additionalProperties: false,
		};
	},
	String(options: Record<string, unknown> = {}): Schema {
		return { type: "string", ...options };
	},
	Number(options: Record<string, unknown> = {}): Schema {
		return { type: "number", ...options };
	},
	Boolean(options: Record<string, unknown> = {}): Schema {
		return { type: "boolean", ...options };
	},
	Array(item: Schema, options: Record<string, unknown> = {}): Schema {
		return { type: "array", items: item, ...options };
	},
	Optional(schema: Schema): Schema {
		return { ...schema, optional: true };
	},
	Enum(
		values: readonly string[],
		options: Record<string, unknown> = {},
	): Schema {
		return { enum: values, ...options };
	},
};
