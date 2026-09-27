from fastapi import FastAPI
from credits_module.api import router
from credits_module.db import engine
from credits_module.db_models import Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="CarbonVault Credits Engine")

app.include_router(router)