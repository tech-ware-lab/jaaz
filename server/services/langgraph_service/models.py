from pydantic import BaseModel


class InputParam(BaseModel):
    type: str
    description: str
    required: bool
    default: str
