FROM node:12
ENV DEBUG *
RUN ["mkdir", "/src"]
WORKDIR /src
COPY ./package.json .
RUN ["npm", "i"]
COPY *.js .
ENTRYPOINT ["npm", "start"]