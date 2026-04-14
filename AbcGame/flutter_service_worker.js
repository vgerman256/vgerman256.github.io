'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"assets/AssetManifest.bin": "9ac303ae7636d3a0f8c7fc8cb203ec63",
"assets/AssetManifest.bin.json": "62952ea87a4cec1422cd6fdb53dc1c8f",
"assets/assets/alphabet/en/a.svg": "84532a97fd23579dbccf4a97ca33805c",
"assets/assets/alphabet/en/alphabet.json": "70d7ba740614e0da9cd589e329af0f59",
"assets/assets/alphabet/en/b.svg": "9ba52d392c6a42fe1a808d7d917ceafb",
"assets/assets/alphabet/en/c.svg": "6625c2e89da14fa6f15c592d096e1fb9",
"assets/assets/alphabet/en/d.svg": "d970cc4a838e87aec1b1e98f2bc8ae91",
"assets/assets/alphabet/en/e.svg": "c072d9870d20e916f3b43632222d3fc0",
"assets/assets/alphabet/en/f.svg": "f86b26ba5940a97cac9242ea61df90fd",
"assets/assets/alphabet/en/g.svg": "f7999672ed69af28af61675a2ba143e1",
"assets/assets/alphabet/en/h.svg": "75199ca80c50e9dbdf2a5e2a7418550e",
"assets/assets/alphabet/en/i.svg": "ea0af9f7384e3bd6e8924b90f57c26dd",
"assets/assets/alphabet/en/j.svg": "bdd1fb8ef65192c1403f3686d9ad9c21",
"assets/assets/alphabet/en/k.svg": "cf92bcb5a4472d4ab5ad2a4056d2db12",
"assets/assets/alphabet/en/l.svg": "3bbc6b13664baa634749417b86700746",
"assets/assets/alphabet/en/m.svg": "b753942adc3c1d463a99a94859764db3",
"assets/assets/alphabet/en/n.svg": "8ef3722bdf5de6ae3f3c530dc8d194a5",
"assets/assets/alphabet/en/o.svg": "665ae007cfd9a06889f87706e850173f",
"assets/assets/alphabet/en/p.svg": "fe96d661365a77a108ec827a14175c19",
"assets/assets/alphabet/en/q.svg": "00420cf3137cdd8f8e5551414305788e",
"assets/assets/alphabet/en/r.svg": "1b2e9d5f391290f3a16b5056600cb4b5",
"assets/assets/alphabet/en/s.svg": "c375d736b7900645aa7697d9303798c4",
"assets/assets/alphabet/en/t.svg": "fa5f85601e9b9965f224be210f497707",
"assets/assets/alphabet/en/u.svg": "93d50302c8623032195dbfccfe170d61",
"assets/assets/alphabet/en/v.svg": "eee5e3ef43d03d339ea13432ac4a6e6f",
"assets/assets/alphabet/en/w.svg": "21f0d7f189831aec2b150272066a7b96",
"assets/assets/alphabet/en/x.svg": "84dc79008cca5e1615ffd27927ef26c2",
"assets/assets/alphabet/en/y.svg": "f33433db0d38904cbf8709f222b64125",
"assets/assets/alphabet/en/z.svg": "ae23d21ed3671835e55105f166be2795",
"assets/assets/alphabet/ru/%25D0%25B0.svg": "07d761e82de3e3783d6e6cbae0ccc108",
"assets/assets/alphabet/ru/%25D0%25B1.svg": "d455419038ae59401705073fc2a6eec1",
"assets/assets/alphabet/ru/%25D0%25B2.svg": "f966c41829aafe1acdaef048722b1d13",
"assets/assets/alphabet/ru/%25D0%25B3.svg": "3bf3a974ec7195612cddb2550eae371e",
"assets/assets/alphabet/ru/%25D0%25B4.svg": "785474f919e26da76fc6e921e1ef9a80",
"assets/assets/alphabet/ru/%25D0%25B5.svg": "b28104bf2f447a6bcde4aa6190bf897d",
"assets/assets/alphabet/ru/%25D0%25B6.svg": "e16247910274e10e04101d30a6239881",
"assets/assets/alphabet/ru/%25D0%25B7.svg": "e9c0e066e09c504c7f8c2d55596fa5ad",
"assets/assets/alphabet/ru/%25D0%25B8.svg": "a0fd0cfdf4e9aceb6a34717b074e8f8e",
"assets/assets/alphabet/ru/%25D0%25B9.svg": "303198a8ac07e89c9b1c57db921c516e",
"assets/assets/alphabet/ru/%25D0%25BA.svg": "2696584f6384cbc023d26d187bbed454",
"assets/assets/alphabet/ru/%25D0%25BB.svg": "094d2e55da79c322293239ae15cb168e",
"assets/assets/alphabet/ru/%25D0%25BC.svg": "8527c0361082e2ce2e613a0dd920d267",
"assets/assets/alphabet/ru/%25D0%25BD.svg": "caca93ee9f4e4b3c7a66cabad87307c9",
"assets/assets/alphabet/ru/%25D0%25BE.svg": "5bb4ec8a960e4004b7fb1716b829728b",
"assets/assets/alphabet/ru/%25D0%25BF.svg": "d0c0abf59731ae8a7a33385169dbff9a",
"assets/assets/alphabet/ru/%25D1%2580.svg": "eea3275c8281597ce9d790f5b23506d2",
"assets/assets/alphabet/ru/%25D1%2581.svg": "24551fe342ee77ba0e9302310b52ff24",
"assets/assets/alphabet/ru/%25D1%2582.svg": "984ab7d555096a46d72b7ae9391c58c2",
"assets/assets/alphabet/ru/%25D1%2583.svg": "8ffc8015e346053bf4b92fa7b260cdda",
"assets/assets/alphabet/ru/%25D1%2584.svg": "18f4d438691f8d138f86cdc894fba590",
"assets/assets/alphabet/ru/%25D1%2585.svg": "504f8e9cc5f45a284866683465be7898",
"assets/assets/alphabet/ru/%25D1%2586.svg": "505f81e1d7341b24e515abf9fd6ba9f7",
"assets/assets/alphabet/ru/%25D1%2587.svg": "4aa124cd832fa8db7d5c140e9dd7cfb6",
"assets/assets/alphabet/ru/%25D1%2588.svg": "b34328ed83228f4f8c3cf66f52f50cbe",
"assets/assets/alphabet/ru/%25D1%2589.svg": "88cc8104a513cc75bce2bf747c5368f0",
"assets/assets/alphabet/ru/%25D1%258A.svg": "11493931fa57d3cc25b58bd60553e46a",
"assets/assets/alphabet/ru/%25D1%258B.svg": "7f4e8b4935b03df871e2d5fdcf818b37",
"assets/assets/alphabet/ru/%25D1%258C.svg": "15cf2c0cbed029cb9989dd9840c373c6",
"assets/assets/alphabet/ru/%25D1%258D.svg": "f5f397ee6df658956c06a2cefddde644",
"assets/assets/alphabet/ru/%25D1%258E.svg": "c8d9752dee2968a42634d905fc3901d9",
"assets/assets/alphabet/ru/%25D1%258F.svg": "54807a4217ebd9dc20da05832c3e9286",
"assets/assets/alphabet/ru/%25D1%2591.svg": "298513038abff8fa385bde01da18690f",
"assets/assets/alphabet/ru/alphabet.json": "bea00aefb919daf95aba38262e6e6775",
"assets/assets/flags/en.svg": "752070743b0d75275757b71f7dbfaee1",
"assets/assets/flags/ru.svg": "2e5e9eb8e765a0f735f5aff434cded0e",
"assets/FontManifest.json": "7b2a36307916a9721811788013e65289",
"assets/fonts/MaterialIcons-Regular.otf": "cf1347cfdab07f92b4175be1016ed96f",
"assets/NOTICES": "6c3bd50ddad464009c4813fd2fc655c8",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/shaders/stretch_effect.frag": "40d68efbbf360632f614c731219e95f0",
"canvaskit/canvaskit.js": "8331fe38e66b3a898c4f37648aaf7ee2",
"canvaskit/canvaskit.js.symbols": "a3c9f77715b642d0437d9c275caba91e",
"canvaskit/canvaskit.wasm": "9b6a7830bf26959b200594729d73538e",
"canvaskit/chromium/canvaskit.js": "a80c765aaa8af8645c9fb1aae53f9abf",
"canvaskit/chromium/canvaskit.js.symbols": "e2d09f0e434bc118bf67dae526737d07",
"canvaskit/chromium/canvaskit.wasm": "a726e3f75a84fcdf495a15817c63a35d",
"canvaskit/skwasm.js": "8060d46e9a4901ca9991edd3a26be4f0",
"canvaskit/skwasm.js.symbols": "3a4aadf4e8141f284bd524976b1d6bdc",
"canvaskit/skwasm.wasm": "7e5f3afdd3b0747a1fd4517cea239898",
"canvaskit/skwasm_heavy.js": "740d43a6b8240ef9e23eed8c48840da4",
"canvaskit/skwasm_heavy.js.symbols": "0755b4fb399918388d71b59ad390b055",
"canvaskit/skwasm_heavy.wasm": "b0be7910760d205ea4e011458df6ee01",
"favicon.png": "5dcef449791fa27946b3d35ad8803796",
"flutter.js": "24bc71911b75b5f8135c949e27a2984e",
"flutter_bootstrap.js": "d5b15bfe8a4ee4ff7508a079a0cc2bff",
"icons/Icon-192.png": "ac9a721a12bbc803b44f645561ecb1e1",
"icons/Icon-512.png": "96e752610906ba2a93c65f8abe1645f1",
"icons/Icon-maskable-192.png": "c457ef57daa1d16f64b27b786ec2ea3c",
"icons/Icon-maskable-512.png": "301a7604d45b3e739efc881eb04896ea",
"index.html": "9ac70032b24268124bc2ec9f12dda085",
"/": "9ac70032b24268124bc2ec9f12dda085",
"main.dart.js": "fabbf98a440e150a0141cbb7a207744c",
"manifest.json": "c957c086f453846dbcd1345302513fd8",
"version.json": "f6fc9f3e45fb0f18494b3cd76676bbd4"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
