/**
 * Namespaces
 */
if (typeof(extensions) === 'undefined') extensions = {};
if (typeof(extensions.relativeIncludes) === 'undefined') extensions.relativeIncludes = {
	version: '3.0'
};

(function() {
	var self = this,
		prefs = Components.classes["@mozilla.org/preferences-service;1"]
		.getService(Components.interfaces.nsIPrefService).getBranch("extensions.relativeIncludes."),
		notify = require("notify/notify");
		
		
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
		
		if (doc.baseName === 'quickstart.xml#view-quickstart') {
			notify.send('No file selected', 'tools');
			return false;
		}

		try {
			var cwd = doc.file.URI;
			var dir = cwd.substr(0, cwd.lastIndexOf('\/') + 1);
			if (self.isRemote(dir)) {
				var path = ko.filepicker.remoteFileBrowser(dir);

				if (path !== null) {
					var relpath = remoteRelativePath(dir, path.file);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						relpath = self._filter_excludes(dir, relpath);
						var selction = editor.selText;
						if (selction.length > 0) {
							editor.replaceSel(relpath);
						} else {
							editor.insertText(editor.currentPos, relpath);
							editor.gotoPos(editor.currentPos + relpath.length);
						}
					}

				}
			} else {
				var path = ko.filepicker.browseForFile(ko.uriparse.URIToPath(dir));

				if (path !== null) {
					var relpath = relativePath(ko.uriparse.URIToPath(dir), path);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						relpath = self._filter_excludes(dir, relpath);
						var selction = editor.selText;
						if (selction.length > 0) {
							editor.replaceSel(relpath);
						} else {
							editor.insertText(editor.currentPos, relpath);
							editor.gotoPos(editor.currentPos + relpath.length);
						}
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
		
		if (doc.baseName === 'quickstart.xml#view-quickstart') {
			notify.send('No file selected', 'tools');
			return false;
		}
		
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
						var selction = editor.selText;
						if (selction.length > 0) {
							editor.replaceSel(relpath);
						} else {
							editor.insertText(editor.currentPos, relpath);
							editor.gotoPos(editor.currentPos + relpath.length);
						}
					}
				}
			} else {
				var path = ko.filepicker.browseForFile(ko.uriparse.URIToPath(dir));

				if (path) {
					var relpath = relativePath(ko.uriparse.URIToPath(dir), path);
					var editor = currentView.scimoz;
					if (relpath !== null) {
						var selction = editor.selText;
						if (selction.length > 0) {
							editor.replaceSel(relpath);
						} else {
							editor.insertText(editor.currentPos, relpath);
							editor.gotoPos(editor.currentPos + relpath.length);
						}
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
			} else {
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
		} else if (/[a-z0-9-_]+@/i.test(url)) {
			return true;
		}
		
		return false;
	}
	
	this.hideBtn = function() {
		var hide = prefs.getBoolPref('hideButton');
		if (hide) {
			var space = document.getElementById('workspace_left_area');
			if (space !== null) {
				var tabsCont = space.tabs;
				var tabs = tabsCont.children;
				
				for (var i = 0; i < tabs.length; i++) {
					if (tabs[i].label == 'Relative Includes') {
						tabs[i].style.display = 'none';
					}
				}
			}
		}
	}
	
	window.addEventListener('DOMContentLoaded', self.hideBtn);
	
}).apply(extensions.relativeIncludes);
