import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Layout/Navbar';
import PrivateRoute from './components/Layout/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail'; // YENİ
import Meetings from './pages/Meetings';
import './index.css';
import AdminUsers from './pages/AdminUsers';
import Profile from './pages/Profile'; // YENİ

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="App min-h-screen bg-gray-50">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route 
              path="/*" 
              element={
                <PrivateRoute>
                  <Navbar />
                  <div className="pt-16">
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/projects" element={<Projects />} />
                      <Route path="/projects/:projectId" element={<ProjectDetail />} />
                      <Route path="/meetings" element={<Meetings />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/profile" element={<Profile />} /> {/* YENİ */}
                    </Routes>
                  </div>
                </PrivateRoute>
              } 
            />
          </Routes>
        </div>
      </AuthProvider>
    </Router>
  );
}
export default App;