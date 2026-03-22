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
