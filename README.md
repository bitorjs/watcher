# watcher-plugin

> npm i -D watcher-plugin

#### e.g.
```
new BitorPlugin({
  root: process.cwd() + '/app',
  cachefile: '.classloader.js',
  rules: {
    // 自动生成
    components: ["components/**/*.vue"],
    controllers: "controllers/**/*.js",
  },
  onAddCallback: function (ns, path) {
    console.log('add', ns, path)
  },
  onUnlinkCallback: function (ns, path) {
    console.log('del', ns, path)
  },
  onChangeCallback: function (ns) {
    console.log('change', ns)
  },
  onCacheChange(files) {
    console.log(files)
  },
  normalize(data) {
    let import_packages = "";
    let export_packages = {}
    let count = 0;
    for (const p in data) {
      if (data.hasOwnProperty(p)) {
        export_packages[p] = {};
        const arr = data[p];
        arr.forEach(filepath => {
          import_packages += `import x_${count} from '${filepath}';\r\n`;
          export_packages[p][`${p}_${path.basename(filepath).split('.')[0]}`] = `{x_${count}{`;
          ++count;
        });
      }
    }

    return `${import_packages} \r\n\r\nexport default ${JSON.stringify(export_packages, null, 4).replace(/"{|{"/g,'')}`;
  }
})
```