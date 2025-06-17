import React, { useState } from 'react'
import HomeHeader from '../home/HomeHeader'
import { Button } from '../ui/button'
import { Card, CardContent, CardHeader } from '../ui/card'
import { PlusIcon } from 'lucide-react'
import MarkdownIt from 'markdown-it'
import MdEditor from 'react-markdown-editor-lite'
import 'react-markdown-editor-lite/lib/index.css'

// Sample data for knowledge base items
const knowledgeItems = [
  { id: 1, title: 'Item 1', description: 'Description for item 1' },
  { id: 2, title: 'Item 2', description: 'Description for item 2' },
]

const mdParser = new MarkdownIt()

export default function Knowledge() {
  const [showEditor, setShowEditor] = useState(false)
  const [markdown, setMarkdown] = useState('')

  return (
    <div>
      <HomeHeader />
      <div className="flex flex-col px-6">
        <h1 className="text-2xl font-bold mb-4">Knowledge</h1>
        <Button
          className="w-fit mb-5"
          onClick={() => setShowEditor((prev) => !prev)}
        >
          <PlusIcon className="mr-2" />
          Add Knowledge
        </Button>

        {showEditor && (
          <div className="mb-5 border rounded-md overflow-hidden">
            <MdEditor
              value={markdown}
              style={{ height: '500px' }}
              renderHTML={(text) => mdParser.render(text)}
              onChange={({ text }) => setMarkdown(text)}
              onImageUpload={async (file) => {
                console.log('file', file)
                // Upload to your server or S3
                const formData = new FormData()
                formData.append('file', file)
                const res = await fetch('/api/upload', {
                  method: 'POST',
                  body: formData,
                })
                const { url } = await res.json()
                return url // markdown link will be auto-inserted
              }}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '16px',
          }}
        >
          {knowledgeItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="text-lg font-bold">
                {item.title}
              </CardHeader>
              <CardContent>{item.description}</CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
