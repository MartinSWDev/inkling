import { describe, expect, it } from "vitest";
import { PACKS, isCountry, subjectUrlFor, urlFor } from "./packs";
import { ROUNDS } from "./flow";

describe("country packs", () => {
  it("uk URLs are byte-identical to the live paths", () => {
    expect(urlFor("uk", "content")).toBe("/data/content.json");
    expect(urlFor("uk", "subjects")).toBe("/data/subjects.json");
    expect(subjectUrlFor("uk", "CAH01-01-01")).toBe("/subjects/CAH01-01-01.json");
  });
  it("other plays the uk files", () => {
    expect(urlFor("other", "content")).toBe(urlFor("uk", "content"));
    expect(urlFor("other", "subjects")).toBe(urlFor("uk", "subjects"));
    expect(subjectUrlFor("other", "CAH01-01-01")).toBe(subjectUrlFor("uk", "CAH01-01-01"));
    expect(PACKS.other.showCourses).toBe(false);
  });
  it("au lives under /packs/au", () => {
    expect(urlFor("au", "content")).toBe("/packs/au/data/content.json");
    expect(subjectUrlFor("au", "CAH01-01-01")).toBe("/packs/au/subjects/CAH01-01-01.json");
  });
  it("us lives under /packs/us", () => {
    expect(urlFor("us", "content")).toBe("/packs/us/data/content.json");
    expect(urlFor("us", "subjects")).toBe("/packs/us/data/subjects.json");
    expect(subjectUrlFor("us", "CAH01-01-01")).toBe("/packs/us/subjects/CAH01-01-01.json");
  });
  it("uk wording is unchanged", () => {
    expect(PACKS.uk.chipsHint).toBe("Tap the ones you take. Heart your favourites.");
    expect(PACKS.uk.chipsHint).toBe(ROUNDS[0].how);
    expect(PACKS.other.chipsHint).toBe(PACKS.uk.chipsHint);
    expect(PACKS.uk.regionLabel).toBe("Setting");
  });
  it("validates countries", () => {
    expect(isCountry("uk")).toBe(true);
    expect(isCountry("us")).toBe(true);
    expect(isCountry("au")).toBe(true);
    expect(isCountry("other")).toBe(true);
    expect(isCountry("fr")).toBe(false);
    expect(isCountry(null)).toBe(false);
  });
});
