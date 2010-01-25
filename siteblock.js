if (typeof csapuntz == "undefined") {
    var csapuntz = {};
}

csapuntz.siteblock = (function () {
  var sbself = {
    LIST : 'siteblock_list',
    ALLOWED : 'siteblock_allowed',
    PERIOD : 'siteblock_period', 

    newUsageTracker : function() {
       var time_cb = function () {
            var d = new Date();
          
            return d.getTime() / 1000;
       };

       var time_allowed = 0;
       var time_period = 3600;

       var time_used = 0;

       var last_start = -1;
       var last_end = -1;
       
       var check_reset = function (now) {
           if (last_end != -1 &&
               (now - last_end) >= (time_period - time_allowed)) {
              time_used = 0;
           }
       }

       return {
          start: function() {
             last_start = time_cb();
             check_reset(last_start);

             return function() {
                var end = time_cb();
                if (end > last_start)
                    time_used += (end - last_start);

                last_start = -1;
                last_end = end;
             };
          },

          
          allowed: function() {
             var time = time_cb();

             check_reset(time);

             // If we're in an existing interval, count it
             var time_adj = 0;
             if (last_start != -1)
                time_adj = (time - last_start);

             return ((time_used + time_adj) < time_allowed);
          },

          setInterval : function(allowed, period) {
            time_allowed = allowed * 60;
            time_period = period * 60;
          },

          setTimeCallback : function(new_cb) {
            time_cb = new_cb;
          },
       };
    },

    newSiteBlock : function() {
      var path_white;
      var path_black;

      var tabState = {};
      var ref = 0;

      var ut = sbself.newUsageTracker();
      var endfunc;
      
      var get_tracked_tabs = function() {
         var t = [];

         for (var v in tabState) {
            if (v.substring(0, 3) == "Tab")
               t.push(Number(v.substring(3)));
         }

         return t;
      };

      var delete_tab_info = function(tabid) {
         var tabstr = "Tab" + tabid;
         delete tabState[tabstr];
      };

      var get_tab_info = function(tabid) {
         var tabstr = "Tab" + tabid;
         if (tabState[tabstr] === undefined) {
            tabState[tabstr] = { blocked: false };
         } 

         return tabState[tabstr];
      };

      var self = {
         updatePaths : function(paths) {
            if (paths === undefined)
              return;

            paths = paths.split("\n");
            path_white = new Array();
            path_black = new Array();

            for (var i = 0 ; i < paths.length; ++i) {
                var p = paths[i];
                if (p.match(/^\s*$/)) {
                } else {
                   var add = path_black;	    
                   if (p[0] == '+') {
                      p = p.substr(1);
                      add = path_white;
                   }
                   p = p.replace('.', '\\.');
                   p = p.replace('*', '.*');
                   add.push(new RegExp(p, 'ig'));
                }
            }
         },

         isBlocked : function(url) {
            var blocked = false;

            if (url !== undefined && url.match(/https?:/)) {
               var p;
               for (p in path_black) {
                     if (url.search(path_black[p]) != -1) {
                         blocked = true;
                         break;
                     }
               }
               for (p in path_white) {
                     if (url.search(path_white[p]) != -1) {
                         blocked = false;
                         break;
                     }
               }
            }

            return blocked;
         },  // isBlocked
        
         setAllowedUsage : ut.setInterval,

         setTimeCallback : ut.setTimeCallback,

         onTabUpdate : function(tabid, url) {
            var ti = get_tab_info(tabid);
            var blocked = (url !== null) ? self.isBlocked(url) : false;

            if (!ti.blocked && blocked) {
               ref = ref + 1;
               if (ref === 1) {
                  // Start the clock running
                  endfunc = ut.start();
               } 
            } else if (ti.blocked && !blocked) {
               ref = ref - 1;
               if (ref === 0) {
                  endfunc();
               }
            }

            if (url === null) {
                delete_tab_info(tabid);
            } else {
                ti['url'] = url;
                ti['blocked'] = blocked;
            }
         },

         isTabBlocked : function(tabid, url) {  
            var ti = get_tab_info(tabid);

            return ti.blocked && !ut.allowed();
         },

         getBlockedTabs : function() {
            if (ut.allowed()) {
                return [];
            }

            var tabs = get_tracked_tabs();
            var ret = [];
            var i;
            for (i = 0; i < tabs.length; ++i) {
                var ti = get_tab_info(tabs[i]);

                if (ti.blocked)
                    ret.push( { id : tabs[i], url : ti.url } );
            }
            return ret;
         }
       }; // self =

       return self;
     } // newSiteBlock
  }; // self =

  return sbself;
})();

