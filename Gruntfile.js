/* jshint node:true */
module.exports = function (grunt) {
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-stylus');
	grunt.loadNpmTasks('grunt-contrib-symlink');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-ts');
	grunt.loadNpmTasks('intern');

	grunt.initConfig({
		clean: {
			source: {
				src: [ 'build/' ]
			}
		},

		copy: {
			sourceForDebugging: {
				expand: true,
				cwd: '.',
				src: [ '*.ts', 'lib/**/*.ts' ],
				dest: 'build/_debug/'
			},
			typings: {
				expand: true,
				cwd: 'typings/',
				src: [ '**/*.d.ts', '!tsd.d.ts' ],
				dest: 'build/typings/'
			},
			staticFiles: {
				expand: true,
				cwd: '.',
				src: [ 'client.html', 'LICENSE', 'package.json', 'README.md', 'tasks/*.js', 'tests/unit/data/**/*' ],
				dest: 'build/'
			}
		},

		intern: {
			runner: {
				options: {
					runType: 'runner',
					config: 'tests/selftest.intern',
					reporters: [ { id: 'Combined' } ],
					selftest: 'true',
					selftest2: true,
					selftest3: [ 'a', 'b', 'c' ]
				}
			},
			client: {
				options: {
					config: 'tests/selftest.intern',
					reporters: [ { id: 'Combined' } ],
					selftest: 'true',
					selftest2: true,
					selftest3: [ 'a', 'b', 'c' ]
				}
			}
		},

		rename: {
			sourceMaps: {
				expand: true,
				cwd: 'build/',
				src: [ '**/*.js.map' ],
				dest: 'build/_debug/'
			}
		},

		rewriteSourceMapSources: {
			source: {
				options: {
					find: /^.*\/([^\/]+)$/,
					replace: '$1'
				},
				src: [ 'build/**/*.js.map' ]
			}
		},

		stylus: {
			htmlReporter: {
				files: {
					'build/lib/reporters/html/html.css': 'lib/reporters/html/html.styl'
				}
			}
		},

		symlink: {
			source: {
				src: 'node_modules',
				dest: 'build/node_modules'
			}
		},

		ts: {
			source: {
				tsconfig: true
			}
		},

		watch: {
			ts: {
				files: [ '*.ts', 'lib/**/*.ts', 'typings/**/*.ts', 'tests/**/*.ts', 'tsconfig.json' ],
				tasks: [ 'ts:source' ]
			},
			copy: {
				files: [ '*.html' ],
				tasks: [ 'copy:source' ]
			}
		}
	});

	grunt.registerMultiTask('rewriteSourceMapSources', function () {
		var find = this.options().find;
		var replace = this.options().replace;

		grunt.log.writeln('Replacing \x1b[36m' + find + '\x1b[39;49m with \x1b[36m' +
			replace + '\x1b[39;49m in ' + this.filesSrc.length + ' files');

		this.filesSrc.forEach(function (file) {
			var map = JSON.parse(grunt.file.read(file));
			map.sources = map.sources.map(function (source) {
				return source.replace(find, replace);
			});
			grunt.file.write(file, JSON.stringify(map));
		});
	});

	grunt.registerMultiTask('rename', function () {
		this.files.forEach(function (file) {
			grunt.file.mkdir(require('path').dirname(file.dest));
			require('fs').renameSync(file.src[0], file.dest);
			grunt.verbose.writeln('Renamed ' + file.src[0] + ' to ' + file.dest);
		});
		grunt.log.writeln('Moved \x1b[36m' + this.files.length + '\x1b[39;49m files');
	});

	grunt.registerTask('test', [ 'intern:client', 'intern:runner' ]);
	grunt.registerTask('build', [
		'ts:source',
		'copy:typings',
		'copy:sourceForDebugging',
		'rewriteSourceMapSources',
		'rename:sourceMaps',
		'stylus:htmlReporter',
		'copy:staticFiles',
		'symlink:source'
	]);
	grunt.registerTask('ci', [ 'build', 'test' ]);
	grunt.registerTask('default', [ 'clean', 'build', 'watch' ]);
};
