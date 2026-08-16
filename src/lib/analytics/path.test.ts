import { describe, it, expect } from "vitest";
import { normalizeTrackedPath, isAppPath } from "./path";

// The /admin "Visitas ao site" KPIs counted every row. Now that in-app paths
// are tracked, counting them there would silently turn a site-traffic metric
// into a usage metric.
describe("isAppPath", () => {
  it("marks the logged-in area", () => {
    expect(isAppPath("/dashboard")).toBe(true);
    expect(isAppPath("/prep/new")).toBe(true);
    expect(isAppPath("/prep/[id]/ats")).toBe(true);
    expect(isAppPath("/profile/cvs")).toBe(true);
    expect(isAppPath("/partner")).toBe(true);
  });

  it("leaves the public site alone", () => {
    expect(isAppPath("/")).toBe(false);
    expect(isAppPath("/pricing")).toBe(false);
    expect(isAppPath("/signup")).toBe(false);
    expect(isAppPath("/artigos/curriculo-de-rh-ats")).toBe(false);
  });

  it("does not match a public path that merely starts with the same letters", () => {
    expect(isAppPath("/preparacao-gratis")).toBe(false);
    expect(isAppPath("/profissoes")).toBe(false);
  });
});

describe("normalizeTrackedPath", () => {
  it("keeps public paths as they are", () => {
    expect(normalizeTrackedPath("/")).toBe("/");
    expect(normalizeTrackedPath("/pricing")).toBe("/pricing");
    expect(normalizeTrackedPath("/artigos/curriculo-de-rh-ats")).toBe(
      "/artigos/curriculo-de-rh-ats",
    );
  });

  // The in-app funnel is exactly where signups were being lost, and it was
  // invisible because these paths were dropped client-side.
  it("now tracks the in-app funnel", () => {
    expect(normalizeTrackedPath("/dashboard")).toBe("/dashboard");
    expect(normalizeTrackedPath("/prep/new")).toBe("/prep/new");
    expect(normalizeTrackedPath("/profile")).toBe("/profile");
    expect(normalizeTrackedPath("/profile/cvs")).toBe("/profile/cvs");
  });

  // Prep ids are per-user resources. Collapsing them keeps the table free of
  // identifiers and makes the top-paths report aggregate instead of listing
  // one row per prep.
  it("collapses prep ids", () => {
    expect(
      normalizeTrackedPath("/prep/db8e0943-3436-4e29-bf17-27cb3e10435c"),
    ).toBe("/prep/[id]");
    expect(
      normalizeTrackedPath("/prep/db8e0943-3436-4e29-bf17-27cb3e10435c/ats"),
    ).toBe("/prep/[id]/ats");
    expect(
      normalizeTrackedPath("/prep/db8e0943-3436-4e29-bf17-27cb3e10435c/deep-dive"),
    ).toBe("/prep/[id]/deep-dive");
  });

  it("does not mistake /prep/new for an id", () => {
    expect(normalizeTrackedPath("/prep/new")).toBe("/prep/new");
  });

  it("drops operator traffic", () => {
    expect(normalizeTrackedPath("/admin")).toBeNull();
    expect(normalizeTrackedPath("/admin/users")).toBeNull();
    expect(normalizeTrackedPath("/admin/metrics")).toBeNull();
  });

  it("drops anything that is not a usable path", () => {
    expect(normalizeTrackedPath("")).toBeNull();
    expect(normalizeTrackedPath("nao-absoluto")).toBeNull();
  });

  it("strips query and hash so the same page aggregates", () => {
    expect(normalizeTrackedPath("/pricing?utm_source=linkedin")).toBe("/pricing");
    expect(normalizeTrackedPath("/artigos#topo")).toBe("/artigos");
  });

  it("caps absurdly long paths", () => {
    const long = `/${"a".repeat(600)}`;
    expect(normalizeTrackedPath(long)!.length).toBeLessThanOrEqual(300);
  });
});
