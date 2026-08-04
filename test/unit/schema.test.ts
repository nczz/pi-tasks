import { describe, expect, it } from "vitest";
import { Type } from "../../src/schema.ts";

describe("Type.Enum", () => {
	it("emits explicit string type for provider-compatible enum schemas", () => {
		expect(Type.Enum(["a", "b"])).toEqual({
			type: "string",
			enum: ["a", "b"],
		});
	});

	it("preserves schema options", () => {
		expect(Type.Enum(["a"], { description: "example" })).toEqual({
			type: "string",
			enum: ["a"],
			description: "example",
		});
	});
});
