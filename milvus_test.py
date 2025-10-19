# https://milvus.io/de/blog/how-to-get-started-with-milvus.md

from pymilvus import model, MilvusClient, DataType

docs = [
    "Artificial intelligence was founded as an academic discipline in 1956.",
    "Alan Turing was the first person to conduct substantial research in AI.",
    "Born in Maida Vale, London, Turing was raised in southern England.",
]


sentence_transformer_ef = model.dense.SentenceTransformerEmbeddingFunction(
    model_name='all-MiniLM-L6-v2',
    device='cpu'
)


vectors  = sentence_transformer_ef.encode_documents(docs)
data = [ {"id": i, "vector": vectors[i], "text": docs[i]} for i in range(len(vectors)) ]

schema = MilvusClient.create_schema(
auto_id=False,
enable_dynamic_field=True,
)


# Add fields to schema
schema.add_field(field_name="id", datatype=DataType.INT64, is_primary=True)
schema.add_field(field_name="vector", datatype=DataType.FLOAT_VECTOR, dim=384)
schema.add_field(field_name="text", datatype=DataType.VARCHAR, max_length=512)

client = MilvusClient(
    uri="http://localhost:19530",
    token="root:Milvus",
)
client.create_database("milvus_demo")
index_params = client.prepare_index_params()


#  Add indexes
index_params.add_index(
field_name="vector",
index_type="AUTOINDEX",
metric_type="COSINE"
)


# Create collection
client.create_collection(
collection_name="demo_collection",
schema=schema,
index_params=index_params
)


# Insert data into collection
res = client.insert(
collection_name="demo_collection",
data=data
)

query = ["Who is Alan Turing"]
query_embedding = sentence_transformer_ef.encode_queries(query)
# Load collection
client.load_collection(
collection_name="demo_collection"
)


# Vector search
res = client.search(
collection_name="demo_collection",
data=query_embedding,
limit=1,
output_fields=["text"],
)
print(res)
