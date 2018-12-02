const Path = require('path');
const Fs = require('fs');

NEWSCHEMA('Files', function(schema) {

	schema.define('body', String);
	schema.define('path', 'String(500)', true);

	schema.setSave(function($) {

		var user = $.user;
		var model = $.model;

		var project = MAIN.projects.findItem('id', $.id);
		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, model.path);
		var name = U.getName(filename);

		MAIN.log($.user, 'files_save', project, filename);

		// Tries to create a folder
		F.path.mkdir(filename.substring(0, filename.length - name.length));

		if (project.backup)
			MAIN.backup(user, filename, () => Fs.writeFile(filename, model.body, ERROR('files.write')));
		else
			Fs.writeFile(filename, model.body, ERROR('files.write'));

		$.success();
	});
});

NEWSCHEMA('FilesRename', function(schema) {

	schema.define('oldpath', 'String', true);
	schema.define('newpath', 'String', true);

	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.oldpath, model.newpath)) {
				$.invalid('error-permissions');
				return;
			}
		}

		MAIN.log($.user, 'files_rename', project, model.oldpath, model.newpath);

		model.oldpath = Path.join(project.path, model.oldpath);
		model.newpath = Path.join(project.path, model.newpath);

		Fs.rename(model.oldpath, model.newpath, function(err) {
			if (err)
				$.invalid(err);
			else
				$.success();
		});

	});
});

NEWSCHEMA('FilesRemove', function(schema) {
	schema.define('path', 'String', true);
	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, model.path);
		MAIN.log($.user, 'files_remove', project, model.path);

		try {
			var stats = Fs.lstatSync(filename);
			if (stats.isFile() && project.backup)
				MAIN.backup(user, filename, () => Fs.unlink(filename, ERROR('files.remove')));
			else {
				if (stats.isDirectory())
					F.path.rmdir(filename);
				else
					Fs.unlink(filename, ERROR('files.remove'));
			}
		} catch (e) {}

		$.success();
	});
});

NEWSCHEMA('FilesUpload', function(schema) {
	schema.define('path', 'String', true);
	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		$.files.wait(function(file, next) {
			var filename = Path.join(project.path, model.path, file.filename);
			MAIN.log($.user, 'files_upload', project, model.path + file.filename);
			file.move(filename, next);
		}, $.done());

	});
});

NEWSCHEMA('FilesCreate', function(schema) {

	schema.define('path', 'String', true);
	schema.define('folder', Boolean);
	schema.define('clone', 'String');

	schema.addWorkflow('exec', function($) {

		var user = $.user;
		var model = $.model;
		var project = MAIN.projects.findItem('id', $.id);

		if (project == null) {
			$.invalid('error-project');
			return;
		}

		if (!user.sa) {
			if (project.users.indexOf(user.id) === -1) {
				$.invalid('error-permissions');
				return;
			}

			if (!MAIN.authorize(project, $.user, model.path)) {
				$.invalid('error-permissions');
				return;
			}
		}

		var filename = Path.join(project.path, model.path);

		Fs.lstat(filename, function(err) {

			if (err) {
				// file not found
				// we can continue
				if (model.folder) {
					F.path.mkdir(filename);
					$.success();
				} else {
					var name = U.getName(filename);
					F.path.mkdir(filename.substring(0, filename.length - name.length));

					if (model.clone) {
						Fs.copyFile(Path.join(project.path, model.clone), filename, function(err) {
							if (err)
								$.invalid(err);
							else
								$.success();
						});
					} else {
						Fs.writeFile(filename, '', function(err) {
							if (err)
								$.invalid(err);
							else
								$.success();
						});
					}
				}
			} else
				$.invalid('path', model.path + ' already exists');
		});

	});
});