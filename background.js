if (typeof csapuntz == "undefined") {
    var csapuntz = {};
}

csapuntz.siteblock = (function () {
   var path_white;
   var path_black;

   return {
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
     }, 
   };
})();

