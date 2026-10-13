# LifeAdmin – Personal Document Management System

## About the Project

LifeAdmin is a full-stack web application developed to help users organize and manage their important personal documents in one place. It provides a centralized platform for users to register, log in, access a personalized dashboard, and manage document information.

The application aims to simplify document management by helping users keep track of important details and document expiry dates through a user-friendly interface.

##  Objectives

* To provide a centralized platform for managing personal documents.
* To implement secure user registration and login.
* To provide a personalized dashboard for users.
* To simplify document information management.
* To help users track document expiry dates.
* To develop a user-friendly and responsive web application.

##  Features

* **User Registration:** Allows new users to create an account.
* **User Login:** Enables registered users to access their accounts.
* **Password Hashing:** Uses bcryptjs to hash passwords before storing them.
* **JWT Authentication:** Uses JSON Web Tokens for authentication and protected routes.
* **Dashboard:** Displays relevant document information in an organized interface.
* **Document Management:** Helps users manage their personal document information.
* **Expiry Tracking:** Helps users identify documents approaching their expiry dates.
* **Password Recovery:** Provides functionality for resetting account passwords.
* **Database Integration:** Uses MongoDB to store application data.

##  Screenshots

### 1. Login Page

Allows existing users to log in to their accounts.

<img width="1892" height="862" alt="image" src="https://github.com/user-attachments/assets/b022f281-0276-40bc-8936-6c1304751cd1" />


### 2. Registration Page

Allows new users to create an account.

<img width="1888" height="861" alt="image" src="https://github.com/user-attachments/assets/662b55f4-a619-4334-9a79-cb321a10afe0" />


### 3. Dashboard

Provides an overview of document-related information.

<img width="1890" height="862" alt="image" src="https://github.com/user-attachments/assets/cb9b5ce4-dfd3-46e3-afcf-b6646fb5d024" />


### 4. Document Management

Displays the interface for managing personal document information.

<img width="1915" height="861" alt="image" src="https://github.com/user-attachments/assets/e86bcf8b-b326-4167-9a0e-1918f7e0dcbf" />


### 5. Upload Documents

<img width="1895" height="861" alt="image" src="https://github.com/user-attachments/assets/4c8e9e5c-60e8-46da-9a3f-2dc01c9da7da" />


## 🛠️ Tech Stack

### Frontend

* React.js
* JavaScript
* HTML5
* CSS3
* Axios

### Backend

* Node.js
* Express.js
* REST APIs
* JSON Web Token (JWT)
* bcryptjs

### Database

* MongoDB
* Mongoose

### Development Tools

* Visual Studio Code
* Git
* GitHub
* MongoDB Atlas

##  System Architecture

LifeAdmin follows a client-server architecture.

1. **Frontend:** React.js handles the user interface and user interactions.
2. **API Communication:** Axios sends HTTP requests from the frontend to the backend.
3. **Backend:** Node.js and Express.js handle requests, authentication, validation, and application logic.
4. **Authentication:** bcryptjs handles password hashing, while JWT supports authentication for protected routes.
5. **Database:** MongoDB stores application data, and Mongoose manages database interactions.

### Application Flow

React Frontend → Axios → Express REST API → Mongoose → MongoDB

##  Authentication and Security

* Passwords are hashed using bcryptjs rather than stored as plain text.
* JWT is used to authenticate requests to protected endpoints.
* Backend validation helps ensure incoming data meets application requirements.
* Environment variables are used to configure sensitive information.


## 📁 Project Structure

The following structure is illustrative. Actual filenames and folders may vary.

```text
LifeAdmin/
├── client/
│   ├── public/
│   ├── src/
│   └── package.json
├── server/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   └── package.json
├── .gitignore
└── README.md
```

##  Future Enhancements

* Automated notifications for upcoming document expiry dates.
* Document upload, preview, and download functionality.
* Advanced document search and categorization.
* Improved dashboard analytics.
* Additional account security features.

##  Contributors

* Abirami K
* Monisha L
* Nithiyasri R

##  Academic Project

LifeAdmin is an academic full-stack web development project that demonstrates frontend development, backend API integration, database management, and authentication concepts through a practical document management application.
