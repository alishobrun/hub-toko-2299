"""Dijalankan workflow situs katalog (eigerkartasura.github.io) setiap 30 menit, di akar repo situs.

Masukan : /tmp/katalog.json (aksi `katalog`) dan /tmp/info.json (aksi `katalogInfoSemua`) dari mesin Basecamp.
Keluaran: data/katalog.json      salinan data katalog (satu artikel per baris) supaya halaman tampil instan
          data/info/<kode>.json  info resmi produk (deskripsi, fitur, material, ...)
          p/<kode>/index.html    halaman kecil per produk berisi kartu pratinjau (judul, harga, foto) untuk WhatsApp
                                 & media sosial, lalu langsung membuka katalog di produk itu.
Berkas hanya ditulis ulang bila isinya berubah, supaya riwayat git tetap kecil.
"""
import glob, html, json, os, re, shutil, time, urllib.parse

SITUS = 'https://eigerkartasura.github.io'
CDN = 'https://d1yutv2xslo29o.cloudfront.net/'


def baca(p):
    try:
        r = json.load(open(p))
        return r['data'] if r.get('ok') and r.get('data') is not None else None
    except Exception as e:
        print('lewati', p, e)
        return None


def tulis(p, isi):
    lama = None
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            lama = f.read()
    if lama == isi:
        return False
    os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(isi)
    return True


def j(x):
    return json.dumps(x, ensure_ascii=False, separators=(',', ':'))


# ---------- data katalog ----------
k = baca('/tmp/katalog.json')
if k and k.get('items'):
    items = k.pop('items')
    isi = j(k)[:-1] + ',"items":[\n' + ',\n'.join(j(it) for it in items) + '\n]}'
    lama = None
    try:
        lama = json.load(open('data/katalog.json')).get('d')
    except Exception:
        pass
    k['items'] = items
    if lama != k:
        tulis('data/katalog.json', '{"t":%d,"d":%s}\n' % (int(time.time()), isi))
        print('katalog diperbarui:', len(items), 'artikel')
    else:
        print('katalog sama')
else:
    try:
        k = json.load(open('data/katalog.json')).get('d')  # pakai salinan lama untuk halaman produk
    except Exception:
        k = None

# ---------- info produk ----------
info = baca('/tmp/info.json')
if isinstance(info, dict) and info:
    ada = set()
    for g, x in info.items():
        if not (len(g) == 9 and g.isdigit()):
            continue
        ada.add(g)
        tulis(f'data/info/{g}.json', j(x))
    for p in glob.glob('data/info/*.json'):
        if os.path.basename(p)[:-5] not in ada:
            os.remove(p)
    print('info:', len(ada), 'artikel')

# ---------- halaman pratinjau per produk ----------
URUT_UK = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', 'XXL', '3XL', 'XXXL', '4XL']


def kunci_uk(u):
    if u in URUT_UK:
        return (0, URUT_UK.index(u), u)
    try:
        return (1, float(u), u)
    except ValueError:
        return (2, 0, u)


def nama_tampil(s):
    s = re.sub(r'(^|[\s\-(/])([a-z])', lambda m: m.group(1) + m.group(2).upper(), str(s or '').strip().lower())
    s = re.sub(r'\bWs\b', 'WS', s)
    s = re.sub(r'\b(\d+)l\b', r'\1L', s, flags=re.I)
    return re.sub(r'\b(\d+)p\b', r'\1P', s, flags=re.I)


def rp(n):
    return 'Rp' + f'{int(round(n)):,}'.replace(',', '.')


def foto_penuh(u):
    u = str(u or '')
    if not u or re.match(r'^https?:', u):
        return u
    return CDN + re.sub(r'^~', 'product/variant/media/web/', u)


HALAMAN = '''<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{judul}</title>
<meta name="description" content="{desk}">
<meta property="og:type" content="product">
<meta property="og:site_name" content="EIGER Store A. Yani Kartasura">
<meta property="og:locale" content="id_ID">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{judul}">
<meta property="og:description" content="{desk}">
<meta property="og:image" content="{gambar}">
<meta property="og:image:width" content="800">
<meta property="og:image:height" content="800">
<meta property="og:image:alt" content="{nama}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{url}">
<link rel="icon" type="image/png" href="/ikon-192.png">
<meta http-equiv="refresh" content="0; url=/#artikel-{g}">
<script>location.replace('/#artikel-{g}' + (location.search || ''));</script>
<style>body{{font:15px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#F5F5F5;color:#222}}a{{color:#0F2A7A;font-weight:700}}</style>
</head>
<body><p>Membuka <a href="/#artikel-{g}">{nama}</a> di katalog EIGER Kartasura…</p></body>
</html>
'''

if k and k.get('items'):
    ada = set()
    promo_sampai = k.get('promoSampai') or ''
    promo_aktif = promo_sampai >= time.strftime('%Y-%m-%d', time.gmtime(time.time() + 7 * 3600))
    for it in k['items']:
        g = str(it.get('g', ''))
        if not re.fullmatch(r'9\d{8}', g):
            continue
        ada.add(g)
        nama = nama_tampil(it.get('n'))
        pr = it.get('pr') if promo_aktif else None
        uk = sorted({u[0] for w in it.get('w', []) for u in w[1] if u[1] and u[0] != 'NOS'}, key=kunci_uk)
        if pr:
            harga = f"{rp(pr['n'])} (promo -{pr['d']}%, normal {rp(pr['h'])})"
        elif it.get('h'):
            harga = rp(it.get('hm') or it['h'])
        else:
            harga = ''
        bagian = [harga] if harga else []
        bagian.append(('Tersedia ukuran ' + ', '.join(uk[:8]) + (' dll.' if len(uk) > 8 else '')) if uk else 'Tersedia di toko')
        desk = ' · '.join(bagian) + ' di EIGER Store A. Yani Kartasura. Tanya stok lewat WhatsApp.'
        fotos = [foto_penuh(u) for u in (it.get('f') or [])]
        fotos = [u for u in fotos if u and not re.search(r'/(thumbnail|small)/', u)]
        if fotos:
            gambar = 'https://images.weserv.nl/?url=' + urllib.parse.quote(fotos[0], safe='') + '&w=800&h=800&fit=contain&cbg=white&bg=white&output=jpg&q=82'
        else:
            gambar = SITUS + '/og-katalog.jpg'
        e = lambda s: html.escape(str(s), quote=True)
        judul = f"{nama}{' · ' + (rp(pr['n']) if pr else harga) if harga else ''} | EIGER Kartasura"
        tulis(f'p/{g}/index.html', HALAMAN.format(judul=e(judul), desk=e(desk), url=e(f'{SITUS}/p/{g}/'), gambar=e(gambar), nama=e(nama), g=g))
    for d in glob.glob('p/*/'):
        if os.path.basename(os.path.dirname(d)) not in ada:
            shutil.rmtree(d, ignore_errors=True)
    print('halaman produk:', len(ada))
