import { Pinecone, RecordMetadata } from '@pinecone-database/pinecone';
import { OpenAI } from 'openai';
import lodash from 'lodash';
const { chunk } = lodash;

const openai = new OpenAI();
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || ''
});

interface VectorStoreOptions {
  indexName: string;
  namespace?: string;
}

interface ChunkMetadata extends RecordMetadata {
  text: string;
  chunkIndex: number;
  totalChunks: number;
  [key: string]: any;
}

interface QueryResult {
  text: string;
  score: number;
  metadata: ChunkMetadata;
}

interface PineconeMatch {
  id: string;
  score: number;
  metadata: ChunkMetadata;
}

export class VectorStore {
  private index;
  private namespace: string;

  constructor(options: VectorStoreOptions) {
    console.log('Initializing vector store with options:', {
      ...options,
      apiKeyPresent: !!process.env.PINECONE_API_KEY
    });
    this.index = pinecone.index(options.indexName);
    this.namespace = options.namespace || 'default';
  }

  /**
   * Convert text into embeddings using OpenAI's embedding model
   */
  private async textToEmbedding(text: string): Promise<number[]> {
    console.log('Generating embedding for text of length:', text.length);
    const response = await openai.embeddings.create({
      input: text,
      model: 'text-embedding-3-small'
    });
    return response.data[0].embedding;
  }

  /**
   * Store transcript chunks in the vector database
   */
  async storeTranscript(transcript: string, metadata: Record<string, any> = {}): Promise<void> {
    console.log('Storing transcript of length:', transcript.length);
    
    // Split transcript into smaller chunks (around 500 tokens each)
    const chunkSize = 2000; // characters, approximately 500 tokens
    const chunks = chunk(transcript.split(' '), Math.ceil(chunkSize / 5))
      .map((chunkWords: string[]) => chunkWords.join(' '));
    
    console.log('Split transcript into chunks:', chunks.length);

    // Process chunks in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processing batch ${i / batchSize + 1} of ${Math.ceil(chunks.length / batchSize)}`);
      
      const records = await Promise.all(
        batch.map(async (text: string, index: number) => {
          const embedding = await this.textToEmbedding(text);
          const chunkMetadata: ChunkMetadata = {
            text,
            chunkIndex: i + index,
            totalChunks: chunks.length,
            ...metadata
          };
          return {
            id: `chunk_${i + index}`,
            values: embedding,
            metadata: chunkMetadata
          };
        })
      );

      console.log(`Upserting ${records.length} vectors to Pinecone in namespace:`, this.namespace);
      await this.index.upsert(records);
    }
    
    console.log('Finished storing transcript in vector store');
  }

  /**
   * Query the vector database to find relevant chunks
   */
  async query(query: string, topK: number = 5): Promise<QueryResult[]> {
    console.log('Querying vector store for:', query, 'in namespace:', this.namespace);
    const queryEmbedding = await this.textToEmbedding(query);
    
    const results = await this.index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });

    console.log('Found matches:', results.matches.length);

    return results.matches
      .filter((match): match is PineconeMatch => 
        match !== undefined && 
        match.metadata !== undefined && 
        typeof match.metadata.text === 'string' &&
        typeof match.score === 'number'
      )
      .map(match => ({
        text: match.metadata.text,
        score: match.score,
        metadata: match.metadata
      }));
  }

  /**
   * Delete all vectors in the namespace
   */
  async clear(): Promise<void> {
    console.log('Clearing vectors from namespace:', this.namespace);
    await this.index.deleteAll();
  }
} 