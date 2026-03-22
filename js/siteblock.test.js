import { describe, it, expect } from "vitest";
import csapuntz from "./siteblock.js";

function newTracker() {
   var ut = csapuntz.siteblock.newUsageTracker();
   ut.test_time = 0;

   ut.setTimeCallback(function() {
      return ut.test_time;
   });

   ut.setInterval(1, 10);

   return ut;
}

describe("Sample Tests", () => {

   it("dummy", () => {
      expect(0).toBe(0);
   });

   it("blacklist blocking", () => {
      var sb = csapuntz.siteblock.newSiteBlock();
      sb.updatePaths("google.com\ncnn");
      expect(sb.isBlocked("http://google.com")).toBe(true);
      expect(sb.isBlocked("https://cnn.com")).toBe(true);
      expect(sb.isBlocked("http://www.apple.com")).toBe(false);
      expect(sb.isBlocked("file://c:/Windows/system32")).toBe(false);
   });

   it("whitelist (allow-all-except)", () => {
      var sb = csapuntz.siteblock.newSiteBlock();
      sb.updatePaths("*\n+google.com");
      expect(sb.isBlocked("http://google.com")).toBe(false);
      expect(sb.isBlocked("https://cnn.com")).toBe(true);
      expect(sb.isBlocked("http://www.apple.com")).toBe(true);
      expect(sb.isBlocked("file://c:/Windows/system32")).toBe(false);
   });

   it("usage tracker", () => {
      var ut = newTracker();

      expect(ut.allowed()).toBe(true);  // initial

      ut.test_time += 20;

      ut.onBlockedSiteAllowed();
      expect(ut.allowed()).toBe(true);  // started

      ut.test_time += 40;

      ut.onLastBlockedDone();
      expect(ut.allowed()).toBe(true);  // ended

      ut.test_time += 40;

      ut.onBlockedSiteAllowed();
      expect(ut.allowed()).toBe(true);  // started2

      ut.test_time += 40;
      expect(ut.allowed()).toBe(false);  // pre-ended2

      ut.onLastBlockedDone();
      expect(ut.allowed()).toBe(false);  // ended2

      ut.test_time += 540;
      expect(ut.allowed()).toBe(true);  // afterwait

      ut.onBlockedSiteAllowed();
      expect(ut.allowed()).toBe(true);  // started3

      ut.test_time += 20;
      ut.onLastBlockedDone();
      ut.test_time += 20;
      ut.onBlockedSiteAllowed();
      ut.test_time += 41;
      expect(ut.allowed()).toBe(false);  // expired-again
   });

   it("long interval", () => {
      var ut = newTracker();

      ut.onBlockedSiteAllowed();
      ut.test_time += 60;
      expect(ut.allowed()).toBe(false);  // testLongInterval1

      ut.onLastBlockedDone();
      expect(ut.allowed()).toBe(false);  // testLongInterval2
   });

   it("timer and full blocking flow", () => {
      var sb = csapuntz.siteblock.newSiteBlock();
      var time = 100;

      sb.updatePaths("google.com");
      // 1 minute allowed per 10-minute period
      sb.setAllowedUsage(1, 10);
      sb.setTimeCallback(function() { return time; });

      // Visit google at 100 seconds
      expect(sb.blockThisTabChange(1, "http://www.google.com")).toBe(false);  // mon1

      time += 30;
      expect(sb.blockThisTabChange(1, "http://www.apple.com")).toBe(false);  // ok1

      time += 120;
      expect(sb.blockThisTabChange(1, "http://www.google.com")).toBe(false);  // mon2

      time += 60;
      var bt = sb.getBlockedTabs();
      expect(bt.length).toBe(1);  // blocked tabs
      expect(bt[0]).toBe(1);      // google

      sb.blockThisTabChange(1, null);
      expect(sb.blockThisTabChange(2, "http://www.google.com")).toBe(true);  // mon3
      sb.blockThisTabChange(2, null);

      expect(sb.blockThisTabChange(2, "http://www.apple.com")).toBe(false);  // ok2

      time += 600;
      expect(sb.blockThisTabChange(2, "http://www.google.com")).toBe(false);  // mon4
   });

});

describe("read_options", () => {
   it("returns defaults for empty storage", () => {
      const opts = csapuntz.siteblock.read_options({});
      expect(opts.rules).toBe("");
      expect(opts.allowed).toBe(0);
      expect(opts.period).toBe(1440);
   });

   it("parses a fully-populated settings value", () => {
      const opts = csapuntz.siteblock.read_options({
         settings: JSON.stringify({ rules: "google.com", allowed: 15, period: 60 }),
      });
      expect(opts.rules).toBe("google.com");
      expect(opts.allowed).toBe(15);
      expect(opts.period).toBe(60);
   });

   it("fills in missing fields with defaults", () => {
      const opts = csapuntz.siteblock.read_options({
         settings: JSON.stringify({ rules: "cnn.com" }),
      });
      expect(opts.rules).toBe("cnn.com");
      expect(opts.allowed).toBe(0);
      expect(opts.period).toBe(1440);
   });
});

describe("isBlocked edge cases", () => {
   it("returns false before updatePaths is called", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      expect(sb.isBlocked("http://google.com")).toBe(false);
   });

   it("returns false for undefined URL", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      sb.updatePaths("google.com");
      expect(sb.isBlocked(undefined)).toBe(false);
   });

   it("does not match a lookalike of a multi-dot domain", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      sb.updatePaths("bbc.co.uk");
      expect(sb.isBlocked("http://bbc.co.uk")).toBe(true);
      expect(sb.isBlocked("http://bbc.coXuk")).toBe(false);
   });
});

describe("tab tracking", () => {
   it("starts empty", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      expect(sb.emptyTracking()).toBe(true);
   });

   it("becomes non-empty after startTracking", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      sb.startTracking(1);
      expect(sb.emptyTracking()).toBe(false);
   });

   it("does not double-add the same tab", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      sb.startTracking(1);
      sb.startTracking(1);
      expect(sb.stopTracking(1)).toBe(true);
      expect(sb.emptyTracking()).toBe(true);
   });

   it("stopTracking returns true when tab was tracked", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      sb.startTracking(5);
      expect(sb.stopTracking(5)).toBe(true);
   });

   it("stopTracking returns false for unknown tab", () => {
      const sb = csapuntz.siteblock.newSiteBlock();
      expect(sb.stopTracking(99)).toBe(false);
   });
});

describe("state persistence", () => {
   it("usage tracker round-trips accumulated time", () => {
      const ut1 = newTracker();
      ut1.onBlockedSiteAllowed();
      ut1.test_time += 30;
      ut1.onLastBlockedDone(); // 30s used of 60s allowed

      const ut2 = csapuntz.siteblock.newUsageTracker();
      ut2.setTimeCallback(() => ut1.test_time);
      ut2.setInterval(1, 10);
      ut2.setState(ut1.getState());

      expect(ut2.allowed()).toBe(true); // 30s used < 60s allowed

      ut2.onBlockedSiteAllowed();
      ut1.test_time += 35; // 30 + 35 = 65s > 60s allowed
      expect(ut2.allowed()).toBe(false);
   });

   it("siteblock restores tracked tabs across a restart", () => {
      const sb1 = csapuntz.siteblock.newSiteBlock();
      let time = 100;
      sb1.updatePaths("google.com");
      sb1.setAllowedUsage(1, 10);
      sb1.setTimeCallback(() => time);
      sb1.blockThisTabChange(1, "http://www.google.com");
      time += 65; // allowance exhausted (> 60s)

      const sb2 = csapuntz.siteblock.newSiteBlock();
      sb2.updatePaths("google.com");
      sb2.setAllowedUsage(1, 10);
      sb2.setTimeCallback(() => time);
      sb2.setState(sb1.getState());

      expect(sb2.getBlockedTabs()).toEqual([1]);
   });
});
