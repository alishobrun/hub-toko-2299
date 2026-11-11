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


def isi_info(g):
    try:
        return json.load(open(f'data/info/{g}.json', encoding='utf-8'))
    except Exception:
        return {}


def baris(t):
    return [re.sub(r'^(?:[•\-–*]|\d{1,2}[.)])\s*', '', b.strip()) for b in str(t or '').split('\n') if b.strip()]


def ganti_meta(h, nama, isi):
    """Ganti isi <meta name/property=nama> (bila ada) di template."""
    pola = re.compile(r'(<meta (?:name|property)="' + re.escape(nama) + r'" content=")[^"]*(")')
    return pola.sub(lambda m: m.group(1) + isi + m.group(2), h, count=1)


def halaman_produk(tpl, it, g, nama, judul, desk, gambar, foto, harga_angka, uk, promo):
    e = lambda x: html.escape(str(x), quote=True)
    url = f'{SITUS}/p/{g}/'
    inf = isi_info(g)
    h = tpl
    # jalur relatif (katalog.css, data/, assets/) tetap dari akar situs
    h = h.replace('<head>', '<head>\n  <base href="/">', 1)
    h = re.sub(r'<title>[^<]*</title>', '<title>' + e(judul) + '</title>', h, count=1)
    h = ganti_meta(h, 'description', e(desk))
    h = ganti_meta(h, 'og:type', 'product')
    h = ganti_meta(h, 'og:url', e(url))
    h = ganti_meta(h, 'og:title', e(judul))
    h = ganti_meta(h, 'og:description', e(desk))
    h = ganti_meta(h, 'og:image', e(gambar))
    h = ganti_meta(h, 'og:image:width', '800')
    h = ganti_meta(h, 'og:image:height', '800')
    h = ganti_meta(h, 'og:image:alt', e(nama))
    h = re.sub(r'<link rel="canonical" href="[^"]*">', '<link rel="canonical" href="' + e(url) + '">', h, count=1)
    # data terstruktur Product untuk Google
    ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': nama, 'sku': g, 'brand': {'@type': 'Brand', 'name': 'EIGER'},
          'url': url, 'category': it.get('k4') or it.get('k3') or ''}
    if foto:
        ld['image'] = foto[:5]
    d = ' '.join(baris(inf.get('d')))[:500]
    if d:
        ld['description'] = d
    if harga_angka:
        ld['offers'] = {'@type': 'Offer', 'priceCurrency': 'IDR', 'price': int(harga_angka), 'availability': 'https://schema.org/InStoreOnly',
                        'url': url, 'seller': {'@type': 'Store', 'name': 'EIGER Store A. Yani Kartasura'}}
    skrip = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>'
    h = h.replace('</head>', '  ' + skrip + '\n</head>', 1)
    # isi produk statis: terbaca mesin pencari & tampil sebelum katalog selesai dimuat (lalu diganti halaman produk katalog)
    fitur = baris(inf.get('f'))[:8]
    statis = ['<section class="seo-produk" id="seoProduk">']
    if foto:
        statis.append(f'<img src="{e(foto[0])}" alt="{e(nama)}" width="320" height="320" referrerpolicy="no-referrer">')
    statis.append(f'<div><h1>{e(nama)}</h1>')
    if promo:
        statis.append(f'<p class="seo-harga">{e(promo)}</p>')
    elif harga_angka:
        statis.append(f'<p class="seo-harga">{e(rp(harga_angka))}</p>')
    statis.append('<p>' + e(('Ukuran tersedia di toko: ' + ', '.join(uk)) if uk else 'Tersedia di toko') + ' · EIGER Store A. Yani Kartasura, Sukoharjo.</p>')
    if d:
        statis.append(f'<p>{e(d)}</p>')
    if fitur:
        statis.append('<ul>' + ''.join(f'<li>{e(x)}</li>' for x in fitur) + '</ul>')
    statis.append(f'<p><a href="/#artikel-{g}">Lihat di katalog</a> · <a href="https://wa.me/6281120022574?text={urllib.parse.quote("Halo EIGER Kartasura, saya mau tanya " + nama + " (kode " + g + ").")}">Tanya lewat WhatsApp</a></p></div></section>')
    h = h.replace('<body>', f'<body data-artikel="{g}">', 1)
    h = h.replace('</header>', '</header>\n  ' + ''.join(statis), 1)
    return h


try:
    TEMPLATE = open('index.html', encoding='utf-8').read()
except Exception:
    TEMPLATE = None

if k and k.get('items') and TEMPLATE:
    ada = set()
    promo_sampai = k.get('promoSampai') or ''
    promo_aktif = promo_sampai >= time.strftime('%Y-%m-%d', time.gmtime(time.time() + 7 * 3600))
    peta = [f'  <url><loc>{SITUS}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>']
    for it in k['items']:
        g = str(it.get('g', ''))
        if not re.fullmatch(r'9\d{8}', g):
            continue
        ada.add(g)
        nama = nama_tampil(it.get('n'))
        pr = it.get('pr') if promo_aktif else None
        uk = sorted({u[0] for w in it.get('w', []) for u in w[1] if u[1] and u[0] != 'NOS'}, key=kunci_uk)
        harga_angka = pr['n'] if pr else (it.get('hm') or it.get('h') or 0)
        promo = f"{rp(pr['n'])} (promo -{pr['d']}%, normal {rp(pr['h'])})" if pr else ''
        harga = promo or (rp(harga_angka) if harga_angka else '')
        bagian = [harga] if harga else []
        bagian.append(('Tersedia ukuran ' + ', '.join(uk[:8]) + (' dll.' if len(uk) > 8 else '')) if uk else 'Tersedia di toko')
        desk = ' · '.join(bagian) + ' di EIGER Store A. Yani Kartasura. Tanya stok lewat WhatsApp.'
        fotos = [foto_penuh(u) for u in (it.get('f') or [])]
        fotos = [u for u in fotos if u and not re.search(r'/(thumbnail|small)/', u)]
        if fotos:
            gambar = 'https://images.weserv.nl/?url=' + urllib.parse.quote(fotos[0], safe='') + '&w=800&h=800&fit=contain&cbg=white&bg=white&output=jpg&q=82'
        else:
            gambar = SITUS + '/og-katalog.jpg'
        judul = f"{nama}{' · ' + rp(harga_angka) if harga_angka else ''} | EIGER Kartasura"
        tulis(f'p/{g}/index.html', halaman_produk(TEMPLATE, it, g, nama, judul, desk, gambar, fotos, harga_angka, uk, promo))
        peta.append(f'  <url><loc>{SITUS}/p/{g}/</loc><changefreq>daily</changefreq><priority>0.7</priority></url>')
    for d in glob.glob('p/*/'):
        if os.path.basename(os.path.dirname(d)) not in ada:
            shutil.rmtree(d, ignore_errors=True)
    tulis('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(peta) + '\n</urlset>\n')
    tulis('robots.txt', f'User-agent: *\nAllow: /\nSitemap: {SITUS}/sitemap.xml\n')
    print('halaman produk:', len(ada))

# ---------- foto produk tanpa latar (untuk slide promo & barang terlaris) ----------
# Dibuat dengan rembg (model isnet-general-use) hanya untuk artikel yang tampil di slide/beranda, dan hanya bila
# fotonya baru/berubah. Hasil: data/potong/<kode>.webp (transparan) + data/potong/daftar.json {kode: alamat foto asal}.
def potong_produk(k):
    if not k or not k.get('items'):
        return
    items = {str(it.get('g')): it for it in k['items']}
    promo_sampai = k.get('promoSampai') or ''
    promo_aktif = promo_sampai >= time.strftime('%Y-%m-%d', time.gmtime(time.time() + 7 * 3600))
    laris = {g: i for i, g in enumerate(k.get('terlaris') or [])}

    def foto1(it):
        fs = [foto_penuh(u) for u in (it.get('f') or [])]
        fs = [u for u in fs if u and not re.search(r'/(thumbnail|small)/', u)]
        return fs[0] if fs else ''
    promo = [it for it in k['items'] if promo_aktif and it.get('pr') and foto1(it)]
    promo.sort(key=lambda it: (-it['pr'].get('d', 0), laris.get(str(it['g']), 999)))
    target = [str(it['g']) for it in promo[:12]]
    for g in (k.get('terlaris') or [])[:20]:
        if g in items and foto1(items[g]) and g not in target:
            target.append(g)
    try:
        daftar = json.load(open('data/potong/daftar.json'))
    except Exception:
        daftar = {}
    perlu = [g for g in target if daftar.get(g) != foto1(items[g]) or not os.path.exists(f'data/potong/{g}.webp')]
    # yang sudah tidak tampil dihapus supaya repo tetap kecil
    for g in list(daftar):
        if g not in target:
            daftar.pop(g, None)
            try:
                os.remove(f'data/potong/{g}.webp')
            except OSError:
                pass
    if perlu:
        import subprocess, sys, io, urllib.request
        try:
            import rembg  # noqa
        except ImportError:
            subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'rembg[cpu]'], check=False)
        try:
            from rembg import remove, new_session
            from PIL import Image
            sesi = new_session('isnet-general-use')
        except Exception as e:
            print('rembg tidak tersedia:', e)
            sesi = None
        if sesi:
            os.makedirs('data/potong', exist_ok=True)
            for g in perlu:
                src = foto1(items[g])
                try:
                    req = urllib.request.Request(src, headers={'User-Agent': 'Mozilla/5.0 (katalog EIGER Kartasura)'})
                    gb = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=60).read())).convert('RGB')
                    o = remove(gb, session=sesi)
                    a = o.getchannel('A')
                    kotak = a.point(lambda v: 255 if v > 12 else 0).getbbox()
                    if not kotak:
                        continue
                    o = o.crop(kotak)
                    tepi = int(max(o.size) * 0.04)
                    kanvas = Image.new('RGBA', (o.size[0] + 2 * tepi, o.size[1] + 2 * tepi), (0, 0, 0, 0))
                    kanvas.paste(o, (tepi, tepi))
                    kanvas.thumbnail((640, 640), Image.LANCZOS)
                    kanvas.save(f'data/potong/{g}.webp', 'WEBP', quality=82, method=6)
                    daftar[g] = src
                except Exception as e:
                    print('gagal memotong', g, e)
    os.makedirs('data/potong', exist_ok=True)
    tulis('data/potong/daftar.json', j(dict(sorted(daftar.items()))))
    print('foto tanpa latar:', len(daftar), '(baru', len(perlu), ')')


try:
    potong_produk(k)
except Exception as e:
    print('potong produk dilewati:', e)
