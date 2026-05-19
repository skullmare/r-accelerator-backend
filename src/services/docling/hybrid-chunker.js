import axios from 'axios';
import FormData from 'form-data';

const { DOCLING_URL } = process.env;

async function getDoclingChunks(fileUrl) {
    const fileResponse = await axios.get(fileUrl, {
        responseType: 'arraybuffer'
    });

    const formData = new FormData();
    formData.append('files', Buffer.from(fileResponse.data), { 
        filename: fileUrl.split('/').pop() || 'document'
    });
    formData.append('chunking_max_tokens', '800');
    formData.append('chunking_merge_peers', 'true');

    const { data } = await axios.post(`${DOCLING_URL}/v1/chunk/hybrid/file`, formData, {
        headers: formData.getHeaders()
    });

    if (!data?.chunks?.length) throw new Error('Docling: чанки не получены');
    return data.chunks.map(c => c.text || c.raw_text).filter(Boolean);
}

export { getDoclingChunks };