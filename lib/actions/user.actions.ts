"use server";

import { revalidatePath } from "next/cache";
import User from "../models/user.model";
import { connectToDB } from "../mongoose";
import Thread from "../models/thread.model";
import { FilterQuery, SortOrder } from "mongoose";

interface UpdateUserParams {
  userId: string;
  username: string;
  name: string;
  bio: string;
  image: string;
  path: string;
}

interface FetchUsers {
  userId: string;
  searchString?: string;
  pageNumber?: number;
  pageSize?: number;
  sortBy?: SortOrder;
}

export async function updateUser({
  userId,
  username,
  name,
  bio,
  image,
  path,
}: UpdateUserParams): Promise<void> {
  connectToDB();

  try {
    await User.findOneAndUpdate(
      { id: userId },
      {
        username: username.toLowerCase(),
        name,
        bio,
        image,
        onboarded: true,
      },
      { upsert: true }
    );

    if (path === "/profile/edit") {
      revalidatePath(path);
    }
  } catch (error: any) {
    throw new Error(`Failed to add/update user: ${error.message}`);
  }
}

export async function fetchUser(userId: string) {
  connectToDB();

  try {
    return await User.findOne({ id: userId });
    // .populate({
    //   path: "communities",
    //   modal: "Community",
    // });
  } catch (error: any) {
    throw new Error(`Failed to fetch User: ${error.message}`);
  }
}

export async function fetchUserThreads(userId: string) {
  connectToDB();

  try {
    // Find all threads authored by user with given userId

    // TODO: For community
    const threads = await User.findOne({ id: userId }).populate({
      path: "threads",
      model: Thread,
      populate: {
        path: "children",
        model: Thread,
        populate: {
          path: "author",
          model: User,
          select: "id name image",
        },
      },
    });

    return threads;
  } catch (error: any) {
    throw new Error(`Failed to fetch user threads: ${error.message}`);
  }
}

export async function fetchUsers({
  userId,
  searchString = "",
  pageNumber = 1,
  pageSize = 20,
  sortBy = "desc",
}: FetchUsers) {
  connectToDB();

  try {
    const skipAmount = (pageNumber - 1) * pageSize;

    const regex = new RegExp(searchString, "i");

    const query: FilterQuery<typeof User> = {
      id: { $ne: userId },
    };

    if (searchString.trim() !== "") {
      query.$or = [
        { username: { $regex: regex } },
        { name: { $regex: regex } },
      ];
    }

    const sortOptions = { createdAt: sortBy };

    const usersQuery = User.find(query)
      .sort(sortOptions)
      .skip(skipAmount)
      .limit(pageSize);

    const totalUsersCount = await User.countDocuments(query);

    const users = await usersQuery.exec();

    const isNext = totalUsersCount > skipAmount + users.length;

    return { users, isNext };
  } catch (error: any) {
    throw new Error(`Failed to fetch users: ${error.message}`);
  }
}

export async function getActivityById(userId: string) {
  connectToDB();

  try {
    const userThread = await Thread.find({ author: userId });

    const childrenThreadIds = userThread.reduce((accumulator, userThread) => {
      return accumulator.concat(userThread.children);
    }, []);

    const replies = await Thread.find({
      _id: { $in: childrenThreadIds },
      author: { $ne: userId },
    }).populate({
      path: "author",
      model: User,
      select: " name image _id",
    });

    return replies;
  } catch (error: any) {
    throw new Error(`Failed to get activity by id: ${error.message}`);
  }
}
