"""
Main FastAPI application file for GitScape.
Author: João Machete
"""
import os
import time
import uvicorn
from app.api import create_app
from app.api import router as api_router
from app.api import limiter
from fastapi import Request
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from fastapi.responses import JSONResponse

app = create_app()
app.include_router(api_router)

# SlowAPI setup — shares the same Limiter instance defined in api.py
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# Custom handler for RateLimitExceeded
@app.exception_handler(RateLimitExceeded)
def rate_limit_handler(request, exc):
    retry_after = getattr(exc, 'retry_after', 60)
    return JSONResponse(
        status_code=429,
        headers={"Retry-After": str(retry_after)},
        content={
            "detail": f"Rate limit reached. Try again in {retry_after} seconds.",
            "retry_after_seconds": int(retry_after),
        },
    )

# add middleware which calculates time of the request processing
# and assign it to the response header
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time-Sec"] = str(process_time)
    return response

if __name__ == "__main__":
    # In production, uvicorn is started via the Dockerfile ENTRYPOINT which
    # binds to 0.0.0.0:8081 (sidecar — only reachable via nginx proxy).
    port = int(os.environ.get("PORT", 8081))
    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
