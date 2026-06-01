import uuid
import structlog
fitz = None  # lazy import
from fastapi import UploadFile

from app.services.chroma_client import get_chroma_collection

log = structlog.get_logger()

def _get_text_splitter():
    """Lazy-load text splitter to avoid pulling in torch at startup."""
    from langchain_text_splitters import RecursiveCharacterTextSplitter
    return RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
        is_separator_regex=False,
    )

async def process_and_store_document(file: UploadFile) -> str:
    """Extract text, chunk it, and store in ChromaDB."""
    global fitz
    doc_id = str(uuid.uuid4())
    content = await file.read()
    
    full_text = ""
    
    # Simple extraction logic based on content type
    if file.content_type == "application/pdf":
        try:
            if fitz is None:
                import fitz as _fitz
                fitz = _fitz
            doc = fitz.open(stream=content, filetype="pdf")
            for page in doc:
                full_text += page.get_text() + "\n"
        except Exception as e:
            log.error("doc.pdf_extract_failed", error=str(e))
            raise ValueError(f"Failed to extract text from PDF: {e}")
    else:
        try:
            full_text = content.decode("utf-8")
        except UnicodeDecodeError:
            raise ValueError("Unsupported file format or encoding.")
            
    if not full_text.strip():
        raise ValueError("Document contains no extractable text.")
        
    # Chunking
    text_splitter = _get_text_splitter()
    chunks = text_splitter.split_text(full_text)
    log.info("doc.chunked", doc_id=doc_id, chunks=len(chunks), filename=file.filename)
    
    # Store in Chroma
    collection = get_chroma_collection()
    if collection:
        # Prepare inputs for Chroma
        ids = [f"{doc_id}_{i}" for i in range(len(chunks))]
        metadatas = [{"doc_id": doc_id, "filename": file.filename, "chunk_index": i} for i in range(len(chunks))]
        
        # Chroma's default embedding function automatically generates embeddings for the documents
        collection.add(
            documents=chunks,
            metadatas=metadatas,
            ids=ids
        )
        log.info("doc.stored_in_chroma", doc_id=doc_id)
    else:
        log.warning("doc.chroma_unavailable", doc_id=doc_id)
        
    return doc_id

def search_documents(query: str, n_results: int = 3) -> list[dict]:
    """Retrieve top chunks for a given query."""
    collection = get_chroma_collection()
    if not collection:
        return []
        
    results = collection.query(
        query_texts=[query],
        n_results=n_results
    )
    
    retrieved = []
    if results and results["documents"]:
        for i, doc_str in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i]
            retrieved.append({
                "content": doc_str,
                "metadata": meta
            })
            
    return retrieved
