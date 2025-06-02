# 🦄 Jaaz – AI Design Agent

AI design agent. Local and free alternative for Lovart. AI agent with ability to design, edit and generate images, posters, storyboards, etc. with a creative canvas board for fast iterations and layout publishing

<div align="center"> <a href="https://github.com/11cafe/localart/releases/latest/download/Jaaz-1.0.5-arm64.dmg"> <img src="https://img.shields.io/badge/⬇️%20Download%20for-macOS-black?style=for-the-badge&logo=apple" alt="Download for macOS" /> </a> &nbsp;&nbsp; <a href="https://github.com/11cafe/localart/releases/latest/download/Jaaz-1.0.5.exe"> <img src="https://img.shields.io/badge/⬇️%20Download%20for-Windows-blue?style=for-the-badge&logo=windows" alt="Download for Windows" /> </a> </div>

<img width="900" alt="Screenshot 2025-06-02 at 3 51 56 AM" src="https://github.com/user-attachments/assets/5d8efe74-99b0-41bc-aa3e-6f7b92b69c36" />

<img width="900" alt="Screenshot 2025-06-02 at 3 58 24 AM" src="https://github.com/user-attachments/assets/e4ca2740-c3a0-4d3b-be38-32d66fb419cc" />

## ✨ Key Features

- AI designer agent powered by LLM that can smartly write prompt and batch generate images or even a whole storyboard!
- Support Ollama, Stable Diffusion, Flux Dev, local image and LLM models for free image generations
- Edit images in conversation using GPT-4o, Flux Kontext: object removal, style transfer, edit specific elements in image, consistent character generation etc. All through chat!
- Canvas and storyboard: unleash your creativity using our infinite canvas!
- [Upcoming] Video generations through Wan2.1, Kling, and video creation and editing agent

---

- Available for **macOS** and **Windows**
- Use Claude, OpenAI, Gemini via API key, or run locally with [Ollama](https://github.com/ollama/ollama) for **100% free** usage
- Use image generation models like **GPT-4O, Recraft, Flux, Google Imagen**, etc. through Replicate API key
- Support local Huggingface models like **SDXL, Flux Dev** for free local image generations

---

## Usage

1. Add LLM API key like OpenAI or Claude, or install [Ollama](https://ollama.com/) to use local models
2. Add image generations API key like [Replicate](https://replicate.com/) 

<img width="1485" alt="Screenshot 2025-06-02 at 3 08 51 PM" src="https://github.com/user-attachments/assets/80bf76b1-229b-4491-893e-3f5102062a37" />

3. Start chatting with agent to generate stories or storyboards!

<img width="1727" alt="Screenshot 2025-06-02 at 3 03 49 PM" src="https://github.com/user-attachments/assets/6001af3a-2e2d-4bce-8112-7ee81cc75670" />


## Manual Install (For Linux or local builds)

First git clone this repo:

`git clone https://github.com/11cafe/localart`


`cd server`

`pip install -r requirements.txt`

`python main.py`

## Development

`cd react`

`npm i && npm run dev`

`cd server`

`pip install -r requirements.txt`

`python main.py`
