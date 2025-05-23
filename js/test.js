import csapuntz from "./siteblock.js";

YAHOO.namespace("csapuntz");

var Assert = YAHOO.util.Assert;

function newTracker() {
   var ut = csapuntz.siteblock.newUsageTracker();
   ut.test_time = 0;

   ut.setTimeCallback(function() {
      return ut.test_time;
      });

   ut.setInterval(1, 10);

   return ut;
}

function assertArrayEqual(a, b, msg) {
    if (a.length != b.length) {
       Assert.fail( msg );
       return;
    }

    for (var i = 0 ; i < a.length; ++i) {
       Assert.areSame(a[i], b[i], msg);
    }
}

YAHOO.csapuntz.TestCase = new YAHOO.tool.TestCase({
   name : "Sample Tests",

   testDummy : function () {
        Assert.areEqual(0, 0);
   },

   testBlack : function () {
     var sb = csapuntz.siteblock.newSiteBlock();
     sb.updatePaths("google.com\ncnn");
     Assert.areEqual(sb.isBlocked("http://google.com"), true, "http://google.com");
     Assert.areEqual(sb.isBlocked("https://cnn.com"), true, "https://cnn.com");
     Assert.areEqual(sb.isBlocked("http://www.apple.com"), false, "http://www.apple.com");
     Assert.areEqual(sb.isBlocked("file://c:/Windows/system32"), false, "file://c:/...");
   },

   testWhite: function() {
     var sb = csapuntz.siteblock.newSiteBlock();
     sb.updatePaths("*\n+google.com");
     Assert.areEqual(sb.isBlocked("http://google.com"), false, "http://google.com");
     Assert.areEqual(sb.isBlocked("https://cnn.com"), true, "https://cnn.com");
     Assert.areEqual(sb.isBlocked("http://www.apple.com"), true, "http://www.apple.com");
     Assert.areEqual(sb.isBlocked("file://c:/Windows/system32"), false, "file://");
   },

   testUsageTracker : function() {
      var ut = newTracker();

      Assert.areEqual(ut.allowed(), true, "initial");

      ut.test_time += 20;
      
      ut.onBlockedSiteAllowed();

      Assert.areEqual(ut.allowed(), true, "started");

      ut.test_time += 40;

      ut.onLastBlockedDone();

      Assert.areEqual(ut.allowed(), true, "ended");
      ut.test_time += 40;

      ut.onBlockedSiteAllowed();
      Assert.areEqual(ut.allowed(), true, "started2");

      ut.test_time += 40;
      Assert.areEqual(ut.allowed(), false, "pre-ended2");

      ut.onLastBlockedDone();
      Assert.areEqual(ut.allowed(), false, "ended2");

      ut.test_time += 540;
      Assert.areEqual(ut.allowed(), true, "afterwait");

      ut.onBlockedSiteAllowed();
      Assert.areEqual(ut.allowed(), true, "started3");

      ut.test_time += 20;
      ut.onLastBlockedDone();
      ut.test_time += 20;
      ut.onBlockedSiteAllowed();
      ut.test_time += 41;
      Assert.areEqual(ut.allowed(), false, "expired-again");
   },

   testLongInterval : function() {
      var ut = newTracker();

      ut.onBlockedSiteAllowed();
      ut.test_time += 60;
      Assert.areEqual(ut.allowed(), false, "testLongInterval1");
 
      ut.onLastBlockedDone();
      Assert.areEqual(ut.allowed(), false, "testLongInterval2");
   },

   testTimer: function() {
     var sb = csapuntz.siteblock.newSiteBlock();

     var time = 100;

     sb.updatePaths("google.com");
     // 15 minutes a day allowed
     sb.setAllowedUsage(1, 10);
     sb.setTimeCallback(function() {
             return time;
        });

     // Visit google at 100 seconds
     Assert.areEqual(sb.blockThisTabChange(1, "http://www.google.com"), false, "mon1");

     time += 30;

     Assert.areEqual(sb.blockThisTabChange(1, "http://www.apple.com"), false, "ok1");

     time += 120;

     Assert.areEqual(sb.blockThisTabChange(1, "http://www.google.com"), false, "mon2");
      
     time += 60;
     var bt = sb.getBlockedTabs();

     Assert.areSame(bt.length, 1, "blocked tabs");
     Assert.areSame(bt[0], 1, "google");

     
     sb.blockThisTabChange(1, null);

     Assert.areEqual(sb.blockThisTabChange(2, "http://www.google.com"), true, "mon3");
     sb.blockThisTabChange(2, null);

     Assert.areEqual(sb.blockThisTabChange(2, "http://www.apple.com"), false, "ok2");

     time += 600;
     Assert.areEqual(sb.blockThisTabChange(2, "http://www.google.com"), false, "mon4");
   },
});

YAHOO.util.Event.onDOMReady(function (){

    //create the logger
    var logger = new YAHOO.tool.TestLogger();
    
    //add the test suite to the runner's queue
    YAHOO.tool.TestRunner.add(YAHOO.csapuntz.TestCase);

    //run the tests
    YAHOO.tool.TestRunner.run();
});
