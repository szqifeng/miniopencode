import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Space, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Tool } from '../../services/types';

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      const res = await (window as any).mockFetch('/api/tools');
      const result = await res.json();
      if (result.success && result.data) {
        setTools(result.data);
      }
    } catch (error) {
      message.error('获取工具列表失败');
    }
  };

  const handleAdd = () => {
    setEditingTool(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool);
    form.setFieldsValue(tool);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await (window as any).mockFetch(`/api/tools/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        message.success('删除成功');
        fetchTools();
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
      if (editingTool) {
        const res = await (window as any).mockFetch(`/api/tools/${editingTool.id}`, {
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
        const res = await (window as any).mockFetch('/api/tools', {
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
      fetchTools();
    } catch (error) {
      console.error('提交失败', error);
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { 
      title: '类型', 
      dataIndex: 'type', 
      key: 'type',
      render: (type: string) => <Tag color={type === 'script' ? 'blue' : type === 'api' ? 'green' : 'orange'}>{type}</Tag>
    },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: string) => <Tag color={status === 'active' ? 'success' : 'default'}>{status === 'active' ? '启用' : '禁用'}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Tool) => (
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
        title="工具管理" 
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新建工具</Button>}
      >
        <Table dataSource={tools} columns={columns} rowKey="id" />
      </Card>

      <Modal
        title={editingTool ? '编辑工具' : '新建工具'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="名称" rules={[{ required: true }]}>
            <Input placeholder="请输入工具名称" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true }]}>
            <Select placeholder="请选择类型">
              <Select.Option value="script">脚本</Select.Option>
              <Select.Option value="api">API</Select.Option>
              <Select.Option value="shell">Shell</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="请输入描述" rows={3} />
          </Form.Item>
          <Form.Item name="status" label="状态" initialValue="active">
            <Select>
              <Select.Option value="active">启用</Select.Option>
              <Select.Option value="inactive">禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
