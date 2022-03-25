FROM node:15
ARG token
WORKDIR /app
COPY . /app
RUN npm install --unsafe-perm
#RUN cd extension && npm install && cd ../server && npm install && cd ..
RUN npm install -g vsce
RUN vsce publish -p $token
