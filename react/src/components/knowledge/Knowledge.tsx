import React, { useState } from 'react'
import HomeHeader from '../home/HomeHeader'
import { Card, CardContent, CardHeader } from '../ui/card'


// Sample data for knowledge base items
const knowledgeItems = [
  { id: 1, title: 'Item 1', description: 'Description for item 1' },
  { id: 2, title: 'Item 2', description: 'Description for item 2' },
]

export default function Knowledge() {

  return (
    <div>
      <HomeHeader />
      <div className="flex flex-col px-6">
        <h1 className="text-2xl font-bold mb-4">Knowledge</h1>

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
