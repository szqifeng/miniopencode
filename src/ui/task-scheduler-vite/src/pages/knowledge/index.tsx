import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { KnowledgeItem } from '../../services/types';

export default function KnowledgePage() {
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    try {
      const res = await (window as any).mockFetch('/api/knowledge');
      const result = await res.json();
      if (result.success && result.data) {
        setKnowledge(result.data);
      }
    } catch (error) {
      message.error('获取知识库失败');
    }
  };

  const handleAdd = () => {
    setEditingItem(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (item: KnowledgeItem) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await (window as any).mockFetch(`/api/knowledge/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        message.success('删除成功');
        fetchKnowledge();
      } else {
        message.error(result.errorMessage || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        const res = await (window as any).mockFetch(`/api/knowledge/${editingItem.id}`, {
          method: 'PUT',
          body: JSON.stringify(values),
        });
        const result = await res.json();
        if (result.success) {
          message.success('更新成功');
        } else {
          message.error(result.errorMessage || '更新失败');
        }
      } else {
        const res = await (window as any).mockFetch('/api/knowledge', {
          method: 'POST',
          body: JSON.stringify(values),
        });
        const result = await res.json();
        if (result.success) {
          message.success('创建成功');
        } else {
          message.error(result.errorMessage || '创建失败');
        }
      }
      setModalVisible(false);
      fetchKnowledge();
    } catch (error) {
      console.error('提交失败', error);
    }
  };

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '分类', dataIndex: 'category', key: 'category', render: (cat: string) => cat ? <Tag>{cat}</Tag> : '-' },
    { 
      title: '标签', 
      dataIndex: 'tags', 
      key: 'tags',
      render: (tags: string[]) => tags?.map((t, i) => <Tag key={i} color="blue">{t}</Tag>) || '-'
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: KnowledgeItem) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card 
        title="知识库管理" 
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建知识</Button>}
      >
        <Table dataSource={knowledge} columns={columns} rowKey="id" />
      </Card>

      <Modal
        title={editingItem ? '编辑知识' : '新建知识'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="请输入标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}>
            <Input.TextArea placeholder="请输入内容" rows={5} />
          </Form.Item>
          <Form.Item name="category" label="分类">
            <Input placeholder="请输入分类" />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select mode="tags" placeholder="输入标签后回车添加">
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
