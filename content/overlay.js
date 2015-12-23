/**
 * Namespaces
 */
if (typeof(extensions) === 'undefined') extensions = {};
if (typeof(extensions.relativeIncludes) === 'undefined') extensions.relativeIncludes = {
	version: '1.0'
};

(function() {
	var self = this,
		prefs = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService).getBranch("extensions.relativeIncludes."),
		notify = require("notify/notify");
		
	if (!('relativeIncludes' in ko)) ko.extensions = {}; 
	var myExt = "relativeIncludes@komodoeditide.com" ; 
	if (!(myExt in ko.extensions)) ko.extensions[myExt] = {};
	if (!('myapp' in ko.extensions[myExt])) ko.extensions[myExt].myapp = {};
	var relativeIncludesData = ko.extensions[myExt].myapp;



	function relativePath(fromPath, toPath) {
		var nsFileFrom = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		nsFileFrom.initWithPath(fromPath);
		var nsFileTo = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
		nsFileTo.initWithPath(toPath);
		return nsFileTo.getRelativeDescriptor(nsFileFrom);
	}

	function remoteRelativePath(fromPath, toPath) {

		var basePaths = fromPath.split('\/'),
		toPaths = toPath.toString().split('\/'),
		newDirs = 0,
		diffDirs = 0,
		totalDirs = 0,
		backDirs = 0,
		baseLength = basePaths.length,
		toLength = toPaths.length,
		newRoute = [],
		output = '',
		x = '',
		y = '';


		for (i = 0; i < toPaths.length; i++) {
			if (toPaths[i] !== basePaths[i]) {
				newRoute.push(toPaths[i]);
				newDirs++;
			} else {
				backDirs++;
			}
			totalDirs++;
		}
		
		x = newDirs - 1;
		y = toLength - baseLength;
		diffDirs = x - y;
		

		for (i = 0; i < diffDirs; i++) {
			output = output + '../';
		}

		for (i = 0; i < newRoute.length - 1; i++) {
			output = output + newRoute[i] + '/';
		}

		output = output + newRoute[newRoute.length - 1];
		return output;
	}

	relativeFromFile = function() {
		var currentView = ko.views.manager.currentView;
		if (currentView === null) {
			notify.send('No file selected', 'tools');
			return false;
		}
		var doc = currentView.koDoc || currentView.document; // Support both K6- and K7+

		try {
			var cwd = doc.file.URI;
			var dir = cwd.substr(0, cwd.lastIndexOf('\/') + 1);
			if (self.isRemote(dir)) {
				var path = ko.filepicker.remoteFileBrowser(dir);

				if (path) {
					var relpath = remoteRelativePath(dir, path.file);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						
						relpath = self._filter_excludes(dir, relpath);
						editor.insertText(editor.currentPos, relpath);
						editor.gotoPos(editor.currentPos + relpath.length);
					}

				}
			} else {
				var path = ko.filepicker.browseForFile(ko.uriparse.URIToPath(dir));

				if (path) {
					var relpath = relativePath(ko.uriparse.URIToPath(dir), path);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						relpath = self._filter_excludes(dir, relpath);
						editor.insertText(editor.currentPos, relpath);
						editor.gotoPos(editor.currentPos + relpath.length);
					}
				}

			}
		} catch (e) {
			notify.send('Error: ' + e.message, 'tools');
		}

	}

	relativeFromBase = function() {
		var currentView = ko.views.manager.currentView;
		if (currentView === null) {
			notify.send('No file selected', 'tools');
			return false;
		}
		var doc = currentView.koDoc || currentView.document; // Support both K6- and K7+
		var currentProject = ko.projects.manager.currentProject;
		
		if (currentProject === null) {
			notify.send('No current project selected', 'tools');
			return false;
		}

		var prefs = currentProject.prefset,
			projectFileDir =
			ko.interpolate.activeProjectPath().replace(/[\/\\][^\/\\]+$/, ''),
			liveImportDir = prefs.hasStringPref('import_dirname') ? prefs.getStringPref('import_dirname') : ''; // or set to empty string
		var projectDir = liveImportDir ? (liveImportDir.match(/(\/\/|[a-zA-Z])/) ? liveImportDir : (projectFileDir + '/' + liveImportDir)) : projectFileDir; 

		try {
			var dir = projectDir;
			if (self.isRemote(dir)) {
				var path = ko.filepicker.remoteFileBrowser(dir);

				if (path) {
					var relpath = remoteRelativePath(dir, path.file);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						editor.insertText(editor.currentPos, relpath);
						editor.gotoPos(editor.currentPos + relpath.length);
					}
				}
			} else {
				var path = ko.filepicker.browseForFile(ko.uriparse.URIToPath(dir));

				if (path) {
					var relpath = relativePath(ko.uriparse.URIToPath(dir), path);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						editor.insertText(editor.currentPos, relpath);
						editor.gotoPos(editor.currentPos + relpath.length);
					}
				}
			}
		} catch (e) {
			notify.send('Error: ' + e.message, 'tools');
		}

	};
	
	this._filter_excludes = function(url, relpath){
		
		var excludes = prefs.getCharPref('exclude');
		var base = ko.uriparse.URIToPath(url);
		var basePaths = base.indexOf('/') !== -1 ? base.split('/') : base.split('\\');
		var count = 0;
		
		if (excludes.length > 0) {
			if (/,/.test(excludes)) {
				excludes = excludes.split(',');
				
				for (var i = 0; i < excludes.length; i++) {
					if (self._in_array(excludes[i], basePaths)) {
						count = count + 1;
					}
				}
			} else {
				if (self._in_array(excludes, basePaths)){
					count = count + 1;
				}
			}
			
			if (count > 0 && /\.\.\//.test(relpath)) {
				for (var i = 0; i < count; i++) {
					relpath = relpath.replace(/\.\.\//, '');
				}
				return relpath;
			}
		} else {
			return relpath;
		}
	}
	
	this._in_array = function (search, array) {
		for (i = 0; i < array.length; i++) {
			if(array[i] ==search ) {
				return true;
			}
		}
		return false;
	}
	
	this.isRemote = function(url) {
		if (/^ftp:\/\//i.test(url)) {
			return true;
		} else if (/^sftp:\/\//i.test(url)) {
			return true;
		} else if (/[a-z0-9]+@/i.test(url)) {
			return true;
		}
		
		return false;
	}
	
}).apply(extensions.relativeIncludes);
