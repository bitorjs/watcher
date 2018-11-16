const chokidar = require('chokidar');
const pathUrl = require('path');
const fs = require('fs');


const toString = Object.prototype.toString;

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
  }

  /**
   * 
   * @param {*} files 'file, dir, glob, or array'
   * @param {*} options 
   */
  createChokidar(files, options = {}) {
    var watcher = chokidar.watch(files, {
      persistent: options.persistance || true,
      ignored: options.ignored || false,
      ignoreInitial: options.ignoreInitial || false,
      followSymlinks: options.followSymlinks || true,
      cwd: this.root || '.',
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

  cacheFiles(namespace, path, action) {
    path = pathUrl.join(this.root, path)
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

      case "init":
        this.watcherFiles[namespace] = []
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

  bindWatcher(watcher, compiler, namespace) {

    this.cacheFiles(namespace, '', 'init');
    let callbackContext = {
      watcher,
      compiler
    }
    let options = this.options;
    watcher
      .on(
        'add',
        options.onAddCallback ? (path) => {
          options.onAddCallback(namespace, path);
          this.cacheFiles(namespace, path, 'add')
        } : (path) => {
          return null;
        }
      )
      .on(
        'change',
        options.onChangeCallback ? (path) => {
          options.onChangeCallback(namespace, path);
          this.cacheFiles(namespace, path, 'change')
        } : (path) => {
          console.log(`File ${path} has been changed`)
        }
      )
      .on(
        'unlink',
        options.onUnlinkCallback ? (path) => {
          options.onUnlinkCallback(namespace, path);
          this.cacheFiles(namespace, path, 'unlink')
        } : (path) => {
          console.log(`File ${path} has been removed`);
        }
      );

    watcher
      .on(
        'addDir',
        options.onAddDirCallback ? (path) => {
          options.onAddDirCallback(namespace, path);
          this.cacheFiles(namespace, path, 'addDir')
        } : (path) => {
          console.log(`Directory ${path} has been added`);
        }
      )
      .on(
        'unlinkDir',
        options.unlinkDirCallback ? (path) => {
          options.unlinkDirCallback(namespace, path);
          this.cacheFiles(namespace, path, 'unlinkDir')
        } : (path) => {
          console.log(`Directory ${path} has been removed`);
        }
      )
      .on(
        'error',
        options.onErrorCallback ? (path) => {
          options.onErrorCallback(namespace, path);
          this.cacheFiles(namespace, path, 'error')
        } : (error) => {
          console.log(`Watcher error: ${error}`);
        }
      )
      .on(
        'ready',
        options.onReadyCallback ? (path) => {
          options.onReadyCallback(namespace, path);
          this.cacheFiles(namespace, path, 'ready')
        } : () => {
          console.log('Initial scan complete. Ready for changes');
        }
      )
      .on(
        'raw',
        options.onRawCallback ? (path) => {
          options.onRawCallback(namespace, path);
          this.cacheFiles(namespace, path, 'raw')
        } : (event, path, details) => {
          return null;
        }
      );

  }

  apply(compiler) {
    this.compiler = compiler;
    Object.keys(this.rules).forEach(key => {
      let namespace = key;
      let rule = this.rules[namespace];

      let watcher = this.createChokidar(rule, this.chokidarOption)
      this.bindWatcher(watcher, compiler, namespace);
    })
  }
}

module.exports = WatcherWebpackPlugin;