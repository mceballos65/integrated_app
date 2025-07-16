// src/components/UserManagementSection.jsx
// User Management Section for Configuration Page

import React, { useState, useEffect } from 'react';
import { useAuth, useUserManagement } from '../hooks/useAuth.jsx';
import useConfigStore from '../store';

const UserManagementSection = ({ onUserAction }) => {
  const { user: currentUser } = useAuth();
  const {
    users,
    loading,
    error,
    loadUsers,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    changePassword
  } = useUserManagement();
  const { adminUserDisabled } = useConfigStore();

  // Form states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Create user form
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    isActive: true
  });

  // Password change form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Success/error messages
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const showMessage = (text, type = 'info') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    
    if (newUser.password !== newUser.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    if (newUser.password.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      const createUserAction = async () => {
        return await createUser(newUser.username, newUser.password, newUser.isActive);
      };
      
      if (onUserAction) {
        await onUserAction(createUserAction);
      } else {
        await createUserAction();
      }
      
      showMessage(`User "${newUser.username}" created successfully`, 'success');
      setNewUser({ username: '', password: '', confirmPassword: '', isActive: true });
      setShowCreateForm(false);
    } catch (err) {
      showMessage(err.message || 'Failed to create user', 'error');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showMessage('New passwords do not match', 'error');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }

    try {
      await changePassword(selectedUser.username, passwordForm.currentPassword, passwordForm.newPassword);
      showMessage(`Password changed successfully for ${selectedUser.username}`, 'success');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordForm(false);
      setSelectedUser(null);
    } catch (err) {
      showMessage(err.message || 'Failed to change password', 'error');
    }
  };

  const handleToggleStatus = async (username) => {
    try {
      const toggleAction = async () => {
        return await toggleUserStatus(username);
      };
      
      if (onUserAction) {
        await onUserAction(toggleAction);
      } else {
        await toggleAction();
      }
      
      const user = users.find(u => u.username === username);
      const newStatus = user?.is_active ? 'disabled' : 'enabled';
      showMessage(`User "${username}" ${newStatus} successfully`, 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to update user status', 'error');
    }
  };

  const handleDeleteUser = async (username) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const deleteAction = async () => {
        return await deleteUser(username);
      };
      
      if (onUserAction) {
        await onUserAction(deleteAction);
      } else {
        await deleteAction();
      }
      
      showMessage(`User "${username}" deleted successfully`, 'success');
    } catch (err) {
      showMessage(err.message || 'Failed to delete user', 'error');
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
          <p className="text-sm text-gray-600">Manage system users and permissions</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {showCreateForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {/* Messages */}
      {message.text && (
        <div className={`p-3 rounded border ${
          message.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' :
          message.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {message.text}
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <div className="bg-gray-50 p-4 rounded border">
          <h4 className="font-semibold mb-3">Create New User</h4>
          <form onSubmit={handleCreateUser} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={newUser.isActive}
                  onChange={(e) => setNewUser({...newUser, isActive: e.target.value === 'true'})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={newUser.confirmPassword}
                  onChange={(e) => setNewUser({...newUser, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
              >
                {loading ? 'Creating...' : 'Create User'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Users List */}
      <div className="bg-white border rounded">
        {loading ? (
          <div className="p-4 text-center text-gray-500">Loading users...</div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">Error: {error}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-gray-500">No users found</div>
        ) : (
          <div className="divide-y">
            {filteredUsers.map((user) => (
              <div key={user.username} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="font-medium text-gray-900">{user.username}</div>
                    <span className={`px-2 py-1 rounded text-xs ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {user.is_default && (
                      <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                        Default
                      </span>
                    )}
                    {user.username === 'admin' && (
                      <>
                        {adminUserDisabled && (
                          <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                            Security Blocked
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Created: {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
                    {user.last_login && (
                      <span className="ml-4">
                        Last login: {new Date(user.last_login).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowPasswordForm(true);
                    }}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Change Password
                  </button>
                  <button
                    onClick={() => handleToggleStatus(user.username)}
                    disabled={loading}
                    className={`px-3 py-1 text-sm text-white rounded ${
                      user.is_active 
                        ? 'bg-yellow-500 hover:bg-yellow-600' 
                        : 'bg-green-500 hover:bg-green-600'
                    } disabled:bg-gray-300`}
                    title={user.username === 'admin' ? 'Toggle active status of admin user' : ''}
                  >
                    {user.is_active ? 'Disable' : 'Enable'}
                  </button>
                  {user.username !== currentUser?.username && (
                    <button
                      onClick={() => handleDeleteUser(user.username)}
                      disabled={loading}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Password Change Modal */}
      {showPasswordForm && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              Change Password for {selectedUser.username}
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  required
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300"
                >
                  {loading ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setSelectedUser(null);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagementSection;
