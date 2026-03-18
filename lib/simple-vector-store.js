// 간단한 파일 기반 벡터 저장소
import fs from 'fs/promises';
import path from 'path';

export class SimpleVectorStore {
  constructor(storePath) {
    this.storePath = storePath;
    this.dataFile = path.join(storePath, 'vectors.json');
  }

  async init() {
    try {
      await fs.mkdir(this.storePath, { recursive: true });
      try {
        await fs.access(this.dataFile);
      } catch {
        // 파일이 없으면 빈 배열로 초기화
        await fs.writeFile(this.dataFile, JSON.stringify([]), 'utf-8');
      }
    } catch (error) {
      throw new Error(`벡터 저장소 초기화 실패: ${error.message}`);
    }
  }

  async add(ids, documents, metadatas, embeddings) {
    const data = await this.load();
    
    for (let i = 0; i < ids.length; i++) {
      const existingIndex = data.findIndex((item) => item.id === ids[i]);
      const item = {
        id: ids[i],
        document: documents[i],
        metadata: metadatas[i] || {},
        embedding: embeddings[i],
      };
      
      if (existingIndex >= 0) {
        data[existingIndex] = item;
      } else {
        data.push(item);
      }
    }
    
    await this.save(data);
  }

  async query(queryEmbedding, nResults = 4) {
    const data = await this.load();
    
    if (data.length === 0) {
      return {
        documents: [[]],
        metadatas: [[]],
        distances: [[]],
      };
    }
    
    // 코사인 유사도 계산
    const similarities = data.map((item) => ({
      ...item,
      similarity: this.cosineSimilarity(queryEmbedding, item.embedding),
    }));
    
    // 유사도 순으로 정렬하고 상위 nResults개 반환
    similarities.sort((a, b) => b.similarity - a.similarity);
    const results = similarities.slice(0, nResults);
    
    return {
      documents: [results.map((r) => r.document)],
      metadatas: [results.map((r) => r.metadata)],
      distances: [results.map((r) => 1 - r.similarity)], // 거리 = 1 - 유사도
    };
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async load() {
    try {
      const content = await fs.readFile(this.dataFile, 'utf-8');
      return JSON.parse(content);
    } catch {
      return [];
    }
  }

  async save(data) {
    await fs.writeFile(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
  }
}
