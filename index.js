const chokidar = require('chokidar');
const pathUrl = require('path');
const fs = require('fs');


const toString = Object.prototype.toString;
const cwd = process.cwd();

class WatcherWebpackPlugin {
  constructor(options = {}) {
    this.options = options;
    this.root = options.root || process.cwd();
    this.cachefile = options.cachefile || '';
    this.rules = options.rules || Object.create(null);
    this.chokidarOption = options.chokidar;

    this.onCacheChange = options.onCacheChange ? options.onCacheChange : () => {}
    this.normalize = options.normalize ? options.normalize : () => {
      return false
    }

    this.watcherFiles = {}
    this.compiler = null;
    if (toString.call(this.cachefile) !== '[object String]') {
      throw new TypeError('The option cacefile must be the String Type.')
    }

    this.pluginConfig = pathUrl.join(cwd, 'config', 'plugin.js');
    if (options.plugin === false) {
      this.pluginConfig = null;
    }
    if (toString.call(options.plugin) === '[object String]') {
      try {
        require(options.plugin)
        this.pluginConfig = options.plugin;
      } catch (error) {
        this.pluginConfig = null;
      }
    }

    this.pluginWatchers = {};
    if (this.pluginConfig !== null) {
      var pcwatcher = chokidar.watch(this.pluginConfig);
      this.pluginHandle(this.pluginConfig)
      pcwatcher.on(
        'change', () => {
          this.pluginHandle(this.pluginConfig)
        })
    }
  }

  pluginHandle(pluginConfig) {
    delete require.cache[pluginConfig]
    const config = require(pluginConfig);
    Object.keys(config).map((key) => {
      if (pluginConfig[key] === undefined) {
        if (config[key].path) {
          Object.keys(this.rules).forEach(namespace => {
            let rule = this.rules[namespace];
            let pluginpath = pathUrl.join(config[key].path, 'app');
            // console.log(key, config[key].path, pluginpath)
            let watcher = this.createChokidar(rule, this.chokidarOption, pluginpath)
            this.bindWatcher(watcher, namespace, pluginpath);
          })
        }
        this.pluginWatchers[key] = true;
      }
    })
  }

  /**
   * 
   * @param {*} files 'file, dir, glob, or array'
   * @param {*} options 
   */
  createChokidar(files, options = {}, fileroot) {
    var watcher = chokidar.watch(files, {
      persistent: options.persistance || true,
      ignored: options.ignored || false,
      ignoreInitial: options.ignoreInitial || false,
      followSymlinks: options.followSymlinks || true,
      cwd: fileroot, //this.root || '.',
      disableGlobbing: options.disableGlobbing || false,
      usePolling: options.usePolling || true,
      interval: options.interval || 100,
      binaryInterval: options.binaryInterval || 300,
      alwaysStat: options.alwaysStat || false,
      depth: options.depth || 99,
      awaitWriteFinish: {
        stabilityThreshold: options.stabilityThreshold || 2000,
        pollInterval: options.pollInterval || 100
      },

      ignorePermissionErrors: options.ignorePermissionErrors || false,
      atomic: options.atomic || true
    });

    return watcher;
  }

  writeCacheFile(cachefile, data) {
    switch (toString.call(data)) {
      case "[object String]":
        fs.writeFileSync(cachefile, data);
        break;
      case "[object Object]":
      case "[object Array]":
        fs.writeFileSync(cachefile, JSON.stringify(data, null, 4));
        break;

      default:
        break;
    }
  }

  cacheFiles(namespace, path, action, fileroot) {
    path = pathUrl.join(fileroot, path)
    switch (action) {
      case 'add':
        this.watcherFiles[namespace].push(path)
        break;
      case 'unlink':
        {
          let ind = this.watcherFiles[namespace].indexOf(path)
          this.watcherFiles[namespace].splice(ind, 1)
        }
        break;
    }

    this.onCacheChange(this.watcherFiles)
    if (this.cachefile.length > 0) {
      let data = this.normalize(this.watcherFiles);
      if (data !== false) {
        this.writeCacheFile(this.cachefile, data);
      }
    }
  }

  bindWatcher(watcher, namespace, fileroot) {

    // this.cacheFiles(namespace, '', 'init', fileroot);
    let options = this.options;
    watcher
      .on(
        'add',
        options.onAddCallback ? (path) => {
          options.onAddCallback(namespace, path);
          this.cacheFiles(namespace, path, 'add', fileroot)
        } : (path) => {
          this.cacheFiles(namespace, path, 'add', fileroot)
        }
      )
      .on(
        'change',
        options.onChangeCallback ? (path) => {
          options.onChangeCallback(namespace, path);
          this.cacheFiles(namespace, path, 'change', fileroot)
        } : (path) => {
          this.cacheFiles(namespace, path, 'change', fileroot)
        }
      )
      .on(
        'unlink',
        options.onUnlinkCallback ? (path) => {
          options.onUnlinkCallback(namespace, path);
          this.cacheFiles(namespace, path, 'unlink', fileroot)
        } : (path) => {
          this.cacheFiles(namespace, path, 'unlink', fileroot)
        }
      );

    watcher
      .on(
        'addDir',
        options.onAddDirCallback ? (path) => {
          options.onAddDirCallback(namespace, path);
          this.cacheFiles(namespace, path, 'addDir', fileroot)
        } : (path) => {
          this.cacheFiles(namespace, path, 'addDir', fileroot)
        }
      )
      .on(
        'unlinkDir',
        options.unlinkDirCallback ? (path) => {
          options.unlinkDirCallback(namespace, path);
          this.cacheFiles(namespace, path, 'unlinkDir', fileroot)
        } : (path) => {
          this.cacheFiles(namespace, path, 'unlinkDir', fileroot)
        }
      )
      .on(
        'error',
        options.onErrorCallback ? (path) => {
          options.onErrorCallback(namespace, path);
          this.cacheFiles(namespace, path, 'error', fileroot)
        } : (error) => {
          console.log(`Watcher error: ${error}`);
        }
      )
      .on(
        'ready',
        options.onReadyCallback ? (path) => {
          options.onReadyCallback(namespace, path);
          // this.cacheFiles(namespace, path, 'ready')
        } : () => {
          console.log('Initial scan complete. Ready for changes');
        }
      )
      .on(
        'raw',
        options.onRawCallback ? (path) => {
          options.onRawCallback(namespace, path);
          this.cacheFiles(namespace, path, 'raw', fileroot)
        } : (event, path, details) => {
          return null;
        }
      );

  }

  apply() {
    Object.keys(this.rules).forEach(key => {
      let namespace = key;
      let rule = this.rules[namespace];
      this.watcherFiles[namespace] = []
      let watcher = this.createChokidar(rule, this.chokidarOption, this.root || '.')
      this.bindWatcher(watcher, namespace, this.root || '.');
    })
  }
}

module.exports = WatcherWebpackPlugin;