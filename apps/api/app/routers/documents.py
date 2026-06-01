from fastapi import APIRouter, UploadFile, File, HTTPException
import structlog
from typing import Any

from app.services.document_service import process_and_store_document

log = structlog.get_logger()
router = APIRouter()

@router.post("/documents/upload", response_model=dict[str, Any])
async def upload_document(file: UploadFile = File(...)):
    """Upload a document to extract text and generate embeddings for Eval context."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    log.info("doc.upload.started", filename=file.filename, content_type=file.content_type)
    
    try:
        doc_id = await process_and_store_document(file)
        return {
            "status": "success",
            "doc_id": doc_id,
            "filename": file.filename,
            "message": "Document indexed successfully."
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        log.error("doc.upload.error", error=str(e), exc_info=True)
        raise HTTPException(status_code=500, detail="Internal server error during document processing.")
