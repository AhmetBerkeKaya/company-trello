// api/controllers/apsController.js
const axios = require('axios');
const querystring = require('querystring');

const CLIENT_ID = process.env.APS_CLIENT_ID;
const CLIENT_SECRET = process.env.APS_CLIENT_SECRET;
// Bucket ismi benzersiz olmalı, client id'den türetiyoruz
const BUCKET_KEY = `viewer-app-${CLIENT_ID ? CLIENT_ID.substring(0, 6).toLowerCase() : 'default'}-bucket`;

let publicToken = null;
let internalToken = null;

// Yardımcı: Token Alma Fonksiyonu
const getToken = async (scope, type) => {
    let cached = type === 'public' ? publicToken : internalToken;
    if (cached && cached.expires_at > Date.now()) return cached;

    try {
        const response = await axios.post(
            'https://developer.api.autodesk.com/authentication/v2/token',
            querystring.stringify({ grant_type: 'client_credentials', scope }),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
                }
            }
        );

        const token = {
            access_token: response.data.access_token,
            expires_in: response.data.expires_in,
            expires_at: Date.now() + (response.data.expires_in - 300) * 1000
        };

        if (type === 'public') publicToken = token;
        else internalToken = token;

        return token;
    } catch (error) {
        console.error("Token Hatası:", error.response?.data || error.message);
        throw new Error("Autodesk Token alınamadı");
    }
};

// 1. Viewer İçin Public Token (Sadece okuma yetkisi)
exports.getPublicToken = async (req, res) => {
    try {
        const token = await getToken('viewables:read', 'public');
        res.json(token);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 2. Dosya Yükleme ve Çeviri (Upload & Translate)
exports.uploadAndTranslate = async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Dosya yok!' });

    try {
        const token = await getToken('bucket:create bucket:read data:read data:write data:create', 'internal');
        const objectName = req.file.originalname;

        // A) Bucket Kontrolü / Oluşturma
        try {
            await axios.get(`https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/details`, {
                headers: { Authorization: `Bearer ${token.access_token}` }
            });
        } catch (e) {
            if (e.response?.status === 404) {
                await axios.post('https://developer.api.autodesk.com/oss/v2/buckets', 
                    { bucketKey: BUCKET_KEY, policyKey: 'transient' }, 
                    { headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' } }
                );
            }
        }

        // B) Signed URL Al
        const signRes = await axios.get(
            `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectName}/signeds3upload`,
            { headers: { Authorization: `Bearer ${token.access_token}` } }
        );

        // C) Dosyayı Yükle (Buffer'dan)
        await axios.put(signRes.data.urls[0], req.file.buffer, {
            headers: { 'Content-Type': 'application/octet-stream' }
        });

        // D) Yüklemeyi Tamamla
        const finalizeRes = await axios.post(
            `https://developer.api.autodesk.com/oss/v2/buckets/${BUCKET_KEY}/objects/${objectName}/signeds3upload`,
            { uploadKey: signRes.data.uploadKey },
            { headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' } }
        );

        // E) URN Hesapla (Base64)
        const urn = Buffer.from(finalizeRes.data.objectId).toString('base64').replace(/\//g, '_').replace(/\+/g, '-').replace(/=+$/, '');

        // F) Çeviri Başlat (RVT/DWG -> SVF)
        try {
            await axios.post('https://developer.api.autodesk.com/modelderivative/v2/designdata/job',
                {
                    input: { urn, compressedUrn: objectName.endsWith('.zip'), rootFilename: objectName },
                    output: { formats: [{ type: 'svf', views: ['3d'] }] }
                },
                { headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json', 'x-ads-force': 'true' } }
            );
        } catch (jobError) {
            // Eğer zaten çevriliyorsa hata vermesin, devam etsin
            console.log("Job status:", jobError.response?.data);
        }

        // Frontend'e URN dönüyoruz
        res.json({ urn, message: 'Çeviri başlatıldı' });

    } catch (error) {
        console.error("Upload Hatası:", error);
        res.status(500).json({ message: 'Autodesk yükleme hatası' });
    }
};