from pymilvus import MilvusClient, model, DataType
from sklearn.preprocessing import normalize
import time

# Beispieldaten
docs = [
    "Artificial intelligence was founded as an academic discipline in 1956.",
    "Alan Turing was the first person to conduct substantial research in AI.",
    "Born in Maida Vale, London, Turing was raised in southern England.",
]

# Embedding vorbereiten
embedding_fn = model.dense.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2",
    device="cpu"
)

vectors = normalize(embedding_fn.encode_documents(docs))
data = [
    {"id": i, "vector": vectors[i], "text": docs[i]}
    for i in range(len(vectors))
]

# Milvus Client
client = MilvusClient(
    uri="http://localhost:19530", 
    token="root:Milvus"
)

# Datenbank erstellen
if "milvus_demo" not in client.list_databases():
    client.create_database("milvus_demo")
    print("Database 'milvus_demo' created.")
else:
    print("Database already exists.")

# Für Tests
COLLECTION_NAME = "demo_collection"
if client.has_collection(COLLECTION_NAME):
    client.drop_collection(COLLECTION_NAME)
    print(f"Collection '{COLLECTION_NAME}' dropped.")

# Schema & Index
schema = MilvusClient.create_schema(auto_id=False, enable_dynamic_field=True)
schema.add_field("id", DataType.INT64, is_primary=True)
schema.add_field("vector", DataType.FLOAT_VECTOR, dim=384)
schema.add_field("text", DataType.VARCHAR, max_length=512)

index_params = client.prepare_index_params()
index_params.add_index("vector", index_type="AUTOINDEX", metric_type="COSINE")

# Neue Collection anlegen
client.create_collection(
    collection_name=COLLECTION_NAME,
    schema=schema,
    index_params=index_params
)
print("Collection created.")

# Daten einfügen
res = client.insert(collection_name=COLLECTION_NAME, data=data)
print(f"Inserted documents.")

# Collection laden
client.load_collection(COLLECTION_NAME)
time.sleep(2)  # Warten auf Indexing

# Abfrage testen
query = ["Who is Alan Turing"]
query_embedding = normalize(embedding_fn.encode_queries(query))

search_result = client.search(
    collection_name=COLLECTION_NAME,
    data=query_embedding,
    limit=1,
    output_fields=["text"]
)

print("Search result:")
for hit in search_result[0]:
    print(f"Distance: {hit['distance']:.4f} | Text: {hit['entity']['text']}")
