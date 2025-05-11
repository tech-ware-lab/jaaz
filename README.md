# AI Marketing Agent & Copilot - Jaaz 

Your all-in-one AI marketing agent team! Fully local desktop app running for free! "Cursor" for marketers and content creators. It's like having an entire marketing team working for you to 10X your efficiency and supercharge your product growth 📈

We are currently in early beta, if you're interested, **please join our waitlist here:** We will reachout to give you a demo to test! This will also help us gain more signals for our product and expedite our development to launch faster.

Features:
- AI powered marketing content editor, with content **auto-completion** and AI edit suggestions, auto generate full marketing post from single image and video demo
- **Corss posting** content to multiple websites, theoretically supports any website by our AI browser automation tool, track your posts performance and view analytics
- **"Replyguy"** - search for best place to mention your product, generate and post replies that naturally mentions your product
- [Upcoming!] **Image & video editions**: add fancy fonts of relevant content to your images, generate and insert relavent illustration images for your article etc.
- [Upcoming!] Multi account profiles support: switch between multiple accounts to post and comment

Available in both MacOS and Windows Desktop apps! You can use Claude, Openai, etc. through API key, or use your locally deployed [Ollama](https://github.com/ollama/ollama) models to enjoy 100% free agent.

Supports Human in loop - AI will prompt you dialogs to take sensitive actions like login, captcha, paywall, confirm post/reply content, etc. to unblock it from executing task safely

<img width="1517" alt="Screenshot 2025-05-11 at 11 28 29 PM" src="https://github.com/user-attachments/assets/739cb0ca-d197-40d9-a0f7-2328b26d210c" />


Powered by our advanced browser automation, file operation, code executor, image generation and edition etc. numberous tools, our agents can utilize these tool to perform various kinds of marketing tasks like creating posts, posting comments, search for best place to post, track post performance and run data analysis, etc.

Security:
- Supports **human-in-loop**: add settings to make AI always prompt you confirmation before doing any senstive actions like posting, commenting, etc.
- You can choose to only sign-in dedicated marketing accounts that doesn't contain any info like payment, credit cards, etc. It can only access scoped data in dedicated folders and browsers separate from your normal browser.
- All actions taken by AI are strictly recorded in history, as both text and screenshot images. You can manually search the records to identify any security risks. We plan to run a smart safeguard model in future to identify and block high risk AI actions in future.



## Features

**✨1Click Cross Posting marketing content to multiple platforms, image, text, video supported!**

<img width="700" alt="Screenshot 2025-05-11 at 11 45 03 PM" src="https://github.com/user-attachments/assets/50694bfa-38b5-4eca-a017-0cc3ccf81781" />



**✍️AI powered content editor, auto complete your writing**

<img width="700" alt="auto-complete" src="https://github.com/user-attachments/assets/bed9858d-20d5-40c0-b580-9b9236414663" />


**🌐AI will prompt you to login to your account, simply by opening the browser and do a regular login to the website you want to post to. You only need to do this once since it will remember you**

<img width="700" alt="Screenshot 2025-05-11 at 10 53 19 PM" src="https://github.com/user-attachments/assets/ca6052e5-9522-4a69-b73e-8806404071cd" />


For exmple, click in "open browser" link in AI's prompt message will open up the login page of Instagram, do your normal login there and it will remember you

<img width="400" alt="Screenshot 2025-05-11 at 11 59 24 PM" src="https://github.com/user-attachments/assets/b6395a86-3d5c-4432-8435-564f04388aec" />

**AI "replyguy" - automatic find relevant posts about your product area, generate replies to mention your product naturally under the post, like Replyguy.com (but Free!)**

You can choose which post to reply to, simply by clicking AI provided options:

<img width="700" alt="replyguy" src="https://github.com/user-attachments/assets/d03482b1-3d6c-423a-a193-e1eeb96923e7" />

And it can ask you to review the reply content before submitting the reply:

<img width="500" alt="replyguy-confirm-reply-content" src="https://github.com/user-attachments/assets/7371dc11-e3fd-4966-88b0-73070fbbd1be" />




## Development

`cd react && npm i`
`cd react && npm run dev`
`cd server && python main.py`
